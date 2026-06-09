const prisma = require('../config/prisma');
const fs = require('fs');
const path = require('path');
const { deleteFileFromS3 } = require('../utils/s3.utils');

// Upload Subject Syllabus
const uploadSyllabus = async (req, res) => {
    try {
        const { category, board, state, medium, stream, subjectName, termId, existingPath, existingName } = req.body;

        if (!existingPath) {
            return res.status(400).json({ error: 'No file path provided' });
        }

        // Validation: Category must be Class 1-12
        const classRegex = /^Class ([1-9]|1[0-2])$/;
        if (!classRegex.test(category)) {
            if (existingPath) await deleteFileFromS3(existingPath);
            return res.status(400).json({ error: 'Syllabus can only be uploaded for Classes 1-12' });
        }

        if (!board) {
            if (existingPath) await deleteFileFromS3(existingPath);
            return res.status(400).json({ error: 'Board is required' });
        }

        // Find optional mediumId if medium name is provided
        let mediumId = null;
        if (medium) {
            const mediumRecord = await prisma.medium.findFirst({
                where: { name: medium }
            });
            mediumId = mediumRecord ? mediumRecord.id : null;
        }

        const newSyllabus = await prisma.subjectSyllabus.create({
            data: {
                subjectName,
                category,
                board,
                state: state || null,
                medium: medium || null,
                stream: stream || null,
                mediumId,
                termId: termId ? parseInt(termId) : null,
                filePath: existingPath,
                fileName: existingName
            },
            include: {
                boardRel: true,
                stateRel: true,
                termRel: true
            }
        });

        // Trigger automatic embedding generation
        const { generateEmbeddings } = require('./embedding.controller');
        // We trigger it asynchronously to not block the main response
        const folderName = `${board}/${category}/${subjectName}`.replace(/\s+/g, '-').toLowerCase();

        generateEmbeddings({
            body: {
                syllabusId: newSyllabus.id,
                pdfUrl: existingPath,
                folderName: folderName,
                type: 'subject'
            }
        }, {
            json: (data) => console.log('Async embedding result:', data),
            status: () => ({ json: (data) => console.error('Async embedding error:', data) })
        });

        // Trigger automatic chapter extraction
        const { extractChaptersFromPdfUrl } = require('../services/ai-syllabus.service');
        extractChaptersFromPdfUrl(existingPath).then(async (chapters) => {
            if (chapters) {
                await prisma.subjectSyllabus.update({
                    where: { id: newSyllabus.id },
                    data: { chapters }
                });
                console.log(`Updated subject syllabus ${newSyllabus.id} with extracted chapters.`);
            }
        }).catch(err => console.error('Error in async chapter extraction:', err));

        res.status(201).json(newSyllabus);

    } catch (error) {
        console.error('Error uploading subject syllabus:', error);
        // Specifically log Prisma errors if they exist
        if (error.code) console.error('Prisma Error Code:', error.code);
        if (error.meta) console.error('Prisma Meta:', error.meta);

        if (req.body.existingPath) {
            await deleteFileFromS3(req.body.existingPath);
        }
        res.status(500).json({ error: 'Failed to upload syllabus', details: error.message });
    }
};

// Get All Subject Syllabi
const getSyllabi = async (req, res) => {
    try {
        const syllabi = await prisma.subjectSyllabus.findMany({
            include: {
                boardRel: true,
                stateRel: true,
                termRel: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(syllabi);
    } catch (error) {
        console.error('Error fetching subject syllabi:', error);
        res.status(500).json({ error: 'Failed to fetch syllabi' });
    }
};

// Delete Subject Syllabus
const deleteSyllabus = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        if (isNaN(parsedId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const syllabus = await prisma.subjectSyllabus.findUnique({
            where: { id: parsedId }
        });

        if (!syllabus) {
            return res.status(404).json({ error: 'Syllabus not found' });
        }

        // Delete from S3
        if (syllabus.filePath) {
            await deleteFileFromS3(syllabus.filePath);
        }

        // Delete embeddings folder from S3 if it exists
        if (syllabus.embedded) {
            const { deleteFolderFromS3, getS3KeyFromUrl } = require('../utils/s3.utils');
            const s3Key = getS3KeyFromUrl(syllabus.embedded);
            if (s3Key) {
                const folderPrefix = path.dirname(s3Key).replace(/\\/g, '/');
                await deleteFolderFromS3(folderPrefix);
            }
        }

        // Delete from DB
        await prisma.subjectSyllabus.delete({
            where: { id: parsedId }
        });

        res.json({ message: 'Syllabus deleted successfully' });

    } catch (error) {
        console.error('Error deleting subject syllabus:', error);
        res.status(500).json({ error: 'Failed to delete syllabus' });
    }
};

// Update Subject Syllabus
const updateSyllabus = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        if (isNaN(parsedId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const { category, board, state, medium, stream, subjectName, termId, existingPath, existingName } = req.body;

        const existingSyllabus = await prisma.subjectSyllabus.findUnique({
            where: { id: parsedId }
        });

        if (!existingSyllabus) {
            if (existingPath) await deleteFileFromS3(existingPath);
            return res.status(404).json({ error: 'Syllabus not found' });
        }

        let filePath = existingSyllabus.filePath;
        let fileName = existingSyllabus.fileName;

        // If new file uploaded (existingPath provided and diff), delete old and update path
        if (existingPath && existingPath !== existingSyllabus.filePath) {
            // Delete old file
            if (existingSyllabus.filePath) {
                console.log("Deleting OLD file from S3 during update:", existingSyllabus.filePath);
                await deleteFileFromS3(existingSyllabus.filePath);
            }
            filePath = existingPath;
            fileName = existingName;
        }

        // Find optional mediumId if medium name is provided
        let mediumId = existingSyllabus.mediumId;
        if (medium !== undefined && medium !== existingSyllabus.medium) {
            if (medium === "" || !medium) {
                mediumId = null;
            } else {
                const mediumRecord = await prisma.medium.findFirst({
                    where: { name: medium }
                });
                mediumId = mediumRecord ? mediumRecord.id : null;
            }
        }

        const updatedSyllabus = await prisma.subjectSyllabus.update({
            where: { id: parsedId },
            data: {
                subjectName: subjectName || existingSyllabus.subjectName,
                category: category || existingSyllabus.category,
                board: board || existingSyllabus.board,
                state: state !== undefined ? (state === "" ? null : state) : existingSyllabus.state,
                medium: medium !== undefined ? (medium === "" ? null : medium) : existingSyllabus.medium,
                stream: stream !== undefined ? (stream === "" ? null : stream) : existingSyllabus.stream,
                mediumId,
                termId: termId !== undefined ? (termId === "" || termId === null ? null : parseInt(termId)) : existingSyllabus.termId,
                filePath,
                fileName
            },
            include: {
                boardRel: true,
                stateRel: true,
                termRel: true
            }
        });

        res.json(updatedSyllabus);

    } catch (error) {
        console.error('Error updating subject syllabus:', error);
        res.status(500).json({ error: 'Failed to update syllabus' });
    }
};

// Get chapters by user profile
const getChaptersByProfile = async (req, res) => {
    try {
        const { category, board, medium } = req.query;

        if (!category || !board) {
            return res.status(400).json({ error: 'Category (class) and board are required' });
        }

        const query = {
            category,
            board,
            chapters: { not: null }
        };

        if (medium && medium !== 'null' && medium !== 'undefined' && medium !== '') {
            query.medium = medium;
        }

        const syllabi = await prisma.subjectSyllabus.findMany({
            where: query,
            select: {
                id: true,
                subjectName: true,
                fileName: true,
                chapters: true,
                filePath: true
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json({
            exam: `${board} ${category}`,
            syllabi
        });

    } catch (error) {
        console.error('Error fetching chapters by profile:', error);
        res.status(500).json({ error: 'Failed to fetch chapters' });
    }
};

module.exports = {
    uploadSyllabus,
    getSyllabi,
    deleteSyllabus,
    updateSyllabus,
    getChaptersByProfile
};


const prisma = require('../config/prisma');
const fs = require('fs');
const path = require('path');
const { deleteFileFromS3 } = require('../utils/s3.utils');

// Upload Syllabus
const uploadSyllabus = async (req, res) => {
    try {
        const { examId, existingPath, existingName } = req.body;
        const file = req.file; // This might be undefined if we uploaded directly from frontend!

        // If direct frontend upload (recommended), logic is simpler:
        // We just get file path/name from body. 
        // BUT current code assumes multer might handle it too.
        // Let's support both or focus on the main flow.
        // Frontend uses S3 upload -> sends existingPath/Name.

        if (!existingPath) {
            // If multer upload is not used, and no path provided
            return res.status(400).json({ error: 'No file path provided' });
        }

        if (!examId) {
            // If manual cleanup needed? But file is already on S3 via frontend. 
            // We can optionally delete it if metadata save fails.
            if (existingPath) await deleteFileFromS3(existingPath);
            return res.status(400).json({ error: 'Exam ID is required' });
        }

        const newSyllabus = await prisma.examSyllabus.create({
            data: {
                examId: parseInt(examId),
                category: req.body.category || 'Aspirant',
                filePath: existingPath,
                fileName: existingName
            },
            include: {
                exam: true,
                categoryRel: true
            }
        });

        // Trigger automatic embedding generation
        const { generateEmbeddings } = require('./embedding.controller');
        const folderName = `exams/${newSyllabus.examId}/${newSyllabus.category}`.replace(/\s+/g, '-').toLowerCase();

        generateEmbeddings({
            body: {
                syllabusId: newSyllabus.id,
                pdfUrl: existingPath,
                folderName: folderName,
                type: 'exam'
            }
        }, {
            json: (data) => console.log('Async embedding result:', data),
            status: () => ({ json: (data) => console.error('Async embedding error:', data) })
        });

        // Trigger automatic chapter extraction
        const { extractChaptersFromPdfUrl } = require('../services/ai-syllabus.service');
        extractChaptersFromPdfUrl(existingPath).then(async (chapters) => {
            if (chapters) {
                await prisma.examSyllabus.update({
                    where: { id: newSyllabus.id },
                    data: { chapters }
                });
                console.log(`Updated syllabus ${newSyllabus.id} with extracted chapters.`);
            }
        }).catch(err => console.error('Error in async chapter extraction:', err));

        res.status(201).json(newSyllabus);

    } catch (error) {
        console.error('Error uploading syllabus:', error);
        // Cleanup orphaned S3 file
        if (req.body.existingPath) {
            await deleteFileFromS3(req.body.existingPath);
        }
        res.status(500).json({ error: 'Failed to upload syllabus' });
    }
};

// Get All Syllabi
const getSyllabi = async (req, res) => {
    try {
        const syllabi = await prisma.examSyllabus.findMany({
            include: {
                exam: true,
                categoryRel: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(syllabi);
    } catch (error) {
        console.error('Error fetching syllabi:', error);
        res.status(500).json({ error: 'Failed to fetch syllabi' });
    }
};

// Delete Syllabus
const deleteSyllabus = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        if (isNaN(parsedId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const syllabus = await prisma.examSyllabus.findUnique({
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
        await prisma.examSyllabus.delete({
            where: { id: parsedId }
        });

        res.json({ message: 'Syllabus deleted successfully' });

    } catch (error) {
        console.error('Error deleting syllabus:', error);
        res.status(500).json({ error: 'Failed to delete syllabus' });
    }
};

// Update Exam Syllabus
const updateSyllabus = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        if (isNaN(parsedId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const { examId, category, existingPath, existingName } = req.body;
        // frontend sends existingPath for the NEW file if it uploaded one.

        const existingSyllabus = await prisma.examSyllabus.findUnique({
            where: { id: parsedId }
        });

        if (!existingSyllabus) {
            if (existingPath) await deleteFileFromS3(existingPath);
            return res.status(404).json({ error: 'Syllabus not found' });
        }

        let filePath = existingSyllabus.filePath;
        let fileName = existingSyllabus.fileName;

        // Check if a new file path is provided (meaning a replacement happened)
        // AND it is different from the old one
        if (existingPath && existingPath !== existingSyllabus.filePath) {
            // Delete old file from S3
            if (existingSyllabus.filePath) {
                console.log("Deleting OLD file from S3 during update:", existingSyllabus.filePath);
                await deleteFileFromS3(existingSyllabus.filePath);
            }
            filePath = existingPath;
            fileName = existingName;
        }

        const updatedSyllabus = await prisma.examSyllabus.update({
            where: { id: parsedId },
            data: {
                examId: examId ? parseInt(examId) : existingSyllabus.examId,
                category: category || existingSyllabus.category,
                filePath,
                fileName
            },
            include: {
                exam: true,
                categoryRel: true
            }
        });

        res.json(updatedSyllabus);

    } catch (error) {
        console.error('Error updating exam syllabus:', error);
        // If we failed to update DB, but had a new file provided, we technically "orphaned" the new file.
        // Optimally we should maybe delete the NEW file if the DB update failed to keep state consistent?
        // But usually safer to keep it than lose user data. 
        // Let's just log.
        res.status(500).json({ error: 'Failed to update syllabus' });
    }
};

// Get chapters by exam name (e.g. "NEET", "JEE")
const getChaptersByExamName = async (req, res) => {
    try {
        const { examName } = req.params;

        if (!examName) {
            return res.status(400).json({ error: 'Exam name is required' });
        }

        // Find the exam by name (case-insensitive)
        const exam = await prisma.exam.findFirst({
            where: {
                name: {
                    equals: examName,
                    mode: 'insensitive'
                }
            }
        });

        if (!exam) {
            return res.status(404).json({ error: `Exam "${examName}" not found` });
        }

        // Get all syllabi for this exam that have chapters extracted
        const syllabi = await prisma.examSyllabus.findMany({
            where: {
                examId: exam.id,
                chapters: { not: null }
            },
            select: {
                id: true,
                fileName: true,
                chapters: true,
                filePath: true
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json({
            exam: exam.name,
            syllabi
        });

    } catch (error) {
        console.error('Error fetching chapters by exam name:', error);
        res.status(500).json({ error: 'Failed to fetch chapters' });
    }
};

// Re-trigger chapter extraction for a specific syllabus
const extractSyllabusChapters = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id);

        if (isNaN(parsedId)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const syllabus = await prisma.examSyllabus.findUnique({
            where: { id: parsedId }
        });

        if (!syllabus) {
            return res.status(404).json({ error: 'Syllabus not found' });
        }

        if (!syllabus.filePath) {
            return res.status(400).json({ error: 'No file path for this syllabus' });
        }

        const { extractChaptersFromPdfUrl } = require('../services/ai-syllabus.service');
        const chapters = await extractChaptersFromPdfUrl(syllabus.filePath);

        if (!chapters) {
            return res.status(422).json({ error: 'Could not extract chapters from PDF' });
        }

        const updated = await prisma.examSyllabus.update({
            where: { id: parsedId },
            data: { chapters }
        });

        res.json({ message: 'Chapters extracted successfully', chapters: updated.chapters });

    } catch (error) {
        console.error('Error extracting chapters:', error);
        res.status(500).json({ error: 'Failed to extract chapters' });
    }
};

module.exports = {
    uploadSyllabus,
    getSyllabi,
    deleteSyllabus,
    updateSyllabus,
    getChaptersByExamName,
    extractSyllabusChapters
};


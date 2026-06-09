const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all categories
const getCategories = async (req, res) => {
    try {
        const categories = await prisma.$queryRaw`
            SELECT id, name FROM "Category" ORDER BY id ASC
        `;
        res.json({ categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

// Get all specific exams (for competitive exams)
const getExams = async (req, res) => {
    try {
        const exams = await prisma.$queryRaw`
            SELECT id, name FROM "Exam" ORDER BY name ASC
        `;
        res.json({ exams });
    } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ error: 'Failed to fetch exams' });
    }
};

// Get all boards
const getBoards = async (req, res) => {
    try {
        const boards = await prisma.$queryRaw`
            SELECT id, name FROM "Board" ORDER BY id ASC
        `;
        res.json({ boards });
    } catch (error) {
        console.error('Error fetching boards:', error);
        res.status(500).json({ error: 'Failed to fetch boards' });
    }
};

// Get states by board ID
const getStatesByBoard = async (req, res) => {
    try {
        const { boardId } = req.params;
        const states = await prisma.$queryRaw`
            SELECT id, name FROM state WHERE board_id = ${parseInt(boardId)} ORDER BY name ASC
        `;
        res.json({ states });
    } catch (error) {
        console.error('Error fetching states:', error);
        res.status(500).json({ error: 'Failed to fetch states' });
    }
};

// Get mediums by state ID
const getMediumsByState = async (req, res) => {
    try {
        const { stateId } = req.params;
        const mediums = await prisma.$queryRaw`
            SELECT id, name FROM medium WHERE state_id = ${parseInt(stateId)} ORDER BY name ASC
        `;
        res.json({ mediums });
    } catch (error) {
        console.error('Error fetching mediums:', error);
        res.status(500).json({ error: 'Failed to fetch mediums' });
    }
};

// Get all streams
const getStreams = async (req, res) => {
    try {
        const streams = await prisma.$queryRaw`
            SELECT id, name FROM "Stream" ORDER BY name ASC
        `;
        res.json({ streams });
    } catch (error) {
        console.error('Error fetching streams:', error);
        res.status(500).json({ error: 'Failed to fetch streams' });
    }
};

// Get all terms
const getTerms = async (req, res) => {
    try {
        const terms = await prisma.$queryRaw`
            SELECT id, "term_name" as name, "category_name" as category, "board_name" as board, "state_name" as state 
            FROM term ORDER BY "term_name" ASC
        `;
        res.json({ terms });
    } catch (error) {
        console.error('Error fetching terms:', error);
        res.status(500).json({ error: 'Failed to fetch terms' });
    }
};

module.exports = {
    getCategories,
    getBoards,
    getStatesByBoard,
    getMediumsByState,
    getExams,
    getStreams,
    getTerms
};

const prisma = require('../config/prisma');

/* GET ALL TERMS */
exports.getAllTerms = async (req, res) => {
    try {
        const terms = await prisma.term.findMany({
            orderBy: {
                termName: 'asc'
            }
        });

        res.json({ terms });
    } catch (error) {
        console.error('Get all terms error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE TERM */
exports.createTerm = async (req, res) => {
    const { termName, category, board, state } = req.body;

    try {
        if (!termName) {
            return res.status(400).json({ message: 'Term name is required' });
        }

        const existingTerm = await prisma.term.findFirst({
            where: {
                termName,
                category: category || null,
                board: board || null,
                state: state || null
            }
        });

        if (existingTerm) {
            return res.status(400).json({ message: 'Term with this name already exists for the selected configuration' });
        }

        const term = await prisma.term.create({
            data: {
                termName,
                category: category || null,
                board: board || null,
                state: state || null
            }
        });

        res.status(201).json({
            message: 'Term created successfully',
            term
        });
    } catch (error) {
        console.error('Create term error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE TERM */
exports.deleteTerm = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.term.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Term deleted successfully' });
    } catch (error) {
        console.error('Delete term error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

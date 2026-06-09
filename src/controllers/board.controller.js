const prisma = require('../config/prisma');

/* GET ALL BOARDS */
exports.getAllBoards = async (req, res) => {
    try {
        const boards = await prisma.board.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            message: 'Boards fetched successfully',
            boards
        });
    } catch (error) {
        console.error('Get all boards error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE BOARD */
exports.createBoard = async (req, res) => {
    const { name } = req.body;

    try {
        if (!name) {
            return res.status(400).json({ message: 'Board name is required' });
        }

        const existingBoard = await prisma.board.findUnique({
            where: { name }
        });

        if (existingBoard) {
            return res.status(400).json({ message: 'Board already exists' });
        }

        const board = await prisma.board.create({
            data: { name }
        });

        res.status(201).json({
            message: 'Board created successfully',
            board
        });
    } catch (error) {
        console.error('Create board error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE BOARD */
exports.deleteBoard = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.board.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Board deleted successfully' });
    } catch (error) {
        console.error('Delete board error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

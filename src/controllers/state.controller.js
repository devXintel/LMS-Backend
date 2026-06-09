const prisma = require('../config/prisma');

/* GET ALL STATES */
exports.getAllStates = async (req, res) => {
    try {
        const states = await prisma.state.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            message: 'States fetched successfully',
            states
        });
    } catch (error) {
        console.error('Get all states error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* GET MEDIUMS BY STATE */
exports.getMediumsByState = async (req, res) => {
    const { stateId } = req.params;

    try {
        if (!stateId) {
            return res.status(400).json({ message: 'State ID is required' });
        }

        const mediums = await prisma.medium.findMany({
            where: {
                stateId: parseInt(stateId)
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            message: 'Mediums fetched successfully',
            mediums
        });
    } catch (error) {
        console.error('Get mediums by state error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE STATE */
exports.createState = async (req, res) => {
    const { name, boardId } = req.body;

    try {
        if (!name || !boardId) {
            return res.status(400).json({ message: 'State name and Board ID are required' });
        }

        const existingState = await prisma.state.findUnique({
            where: { name }
        });

        if (existingState) {
            return res.status(400).json({ message: 'State already exists' });
        }

        const state = await prisma.state.create({
            data: {
                name,
                board_id: parseInt(boardId)
            }
        });

        res.status(201).json({
            message: 'State created successfully',
            state
        });
    } catch (error) {
        console.error('Create state error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE STATE */
exports.deleteState = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.state.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'State deleted successfully' });
    } catch (error) {
        console.error('Delete state error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const prisma = require('../config/prisma');

/* GET ALL MEDIUMS */
exports.getAllMediums = async (req, res) => {
    try {
        const mediums = await prisma.medium.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            message: 'Mediums fetched successfully',
            mediums
        });
    } catch (error) {
        console.error('Get all mediums error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE MEDIUM */
exports.createMedium = async (req, res) => {
    const { name, stateId } = req.body;

    try {
        if (!name || !stateId) {
            return res.status(400).json({ message: 'Medium name and State ID are required' });
        }

        // Check if medium exists for this state
        const existingMedium = await prisma.medium.findFirst({
            where: {
                name,
                stateId: parseInt(stateId)
            }
        });

        if (existingMedium) {
            return res.status(400).json({ message: 'Medium already exists for this state' });
        }

        const medium = await prisma.medium.create({
            data: {
                name,
                stateId: parseInt(stateId)
            }
        });

        res.status(201).json({
            message: 'Medium created successfully',
            medium
        });
    } catch (error) {
        console.error('Create medium error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE MEDIUM */
exports.deleteMedium = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.medium.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Medium deleted successfully' });
    } catch (error) {
        console.error('Delete medium error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

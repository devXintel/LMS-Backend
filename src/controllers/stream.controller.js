const prisma = require('../config/prisma');

/* GET ALL STREAMS */
exports.getAllStreams = async (req, res) => {
    try {
        const streams = await prisma.stream.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            message: 'Streams fetched successfully',
            streams
        });
    } catch (error) {
        console.error('Get all streams error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE STREAM */
exports.createStream = async (req, res) => {
    const { name } = req.body;

    try {
        if (!name) {
            return res.status(400).json({ message: 'Stream name is required' });
        }

        const existingStream = await prisma.stream.findUnique({
            where: { name }
        });

        if (existingStream) {
            return res.status(400).json({ message: 'Stream already exists' });
        }

        const stream = await prisma.stream.create({
            data: { name }
        });

        res.status(201).json({
            message: 'Stream created successfully',
            stream
        });
    } catch (error) {
        console.error('Create stream error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE STREAM */
exports.deleteStream = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.stream.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Stream deleted successfully' });
    } catch (error) {
        console.error('Delete stream error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

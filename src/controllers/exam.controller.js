const prisma = require('../config/prisma');

/* GET ALL EXAMS */
exports.getAllExams = async (req, res) => {
    try {
        const exams = await prisma.exam.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        res.json({ exams });
    } catch (error) {
        console.error('Get all exams error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE EXAM */
exports.createExam = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Exam name is required' });

        const exam = await prisma.exam.create({
            data: { name }
        });

        res.status(201).json(exam);
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* UPDATE EXAM */
exports.updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const exam = await prisma.exam.update({
            where: { id: parseInt(id) },
            data: { name }
        });

        res.json(exam);
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE EXAM */
exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.exam.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Exam deleted successfully' });
    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

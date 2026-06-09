const prisma = require('../config/prisma');

/* GET ALL CATEGORIES */
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: {
                id: 'asc' // Or 'name', depending on desired order. 'asc' by ID usually keeps Class 1, 2... in order if inserted sequentially.
            }
        });

        res.json({
            message: 'Categories fetched successfully',
            categories
        });
    } catch (error) {
        console.error('Get all categories error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* CREATE CATEGORY */
exports.createCategory = async (req, res) => {
    const { name } = req.body;

    try {
        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const existingCategory = await prisma.category.findUnique({
            where: { name }
        });

        if (existingCategory) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const category = await prisma.category.create({
            data: { name }
        });

        res.status(201).json({
            message: 'Category created successfully',
            category
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* DELETE CATEGORY */
exports.deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.category.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

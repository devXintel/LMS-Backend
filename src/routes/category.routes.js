const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// Get all categories
router.get('/', categoryController.getAllCategories);

// Create category
router.post('/', categoryController.createCategory);

// Delete category
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;

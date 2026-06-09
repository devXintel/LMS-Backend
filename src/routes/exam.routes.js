const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');

// Get all exams
router.get('/', examController.getAllExams);

// Create a new exam
router.post('/', examController.createExam);

// Update an exam
router.put('/:id', examController.updateExam);

// Delete an exam
router.delete('/:id', examController.deleteExam);

module.exports = router;

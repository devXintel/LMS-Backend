const express = require('express');
const router = express.Router();
const testController = require('../controllers/test.controller');

// Get all tests for a student
router.get('/student/:studentId', testController.getStudentTests);

// Get test results for a student
router.get('/results/student/:studentId', testController.getTestResults);

// Get single test details
router.get('/:testId', testController.getTestById);

// Get test result details
router.get('/result/:resultId', testController.getTestResultById);

// Submit test answers
router.post('/:testId/submit', testController.submitTest);

// Get detailed test results with AI feedback
router.get('/results/:resultId/detailed', testController.getDetailedResults);

// Placeholder POST /tests route
router.post('/generate-from-video', testController.generateFromVideo);
router.post('/generate-from-topic', testController.generateFromTopic);
router.post('/', (req, res) => res.status(200).json({ message: 'Test creation endpoint placeholder – no DB changes performed.' }));
router.post('/*', (req, res) => res.status(200).json({ message: 'Generic test POST placeholder – no DB changes performed.' }));
module.exports = router;

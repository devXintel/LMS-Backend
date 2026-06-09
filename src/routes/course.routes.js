const express = require('express');
const router = express.Router();
const {
    getCategories,
    getBoards,
    getStatesByBoard,
    getMediumsByState,
    getExams,
    getStreams,
    getTerms
} = require('../controllers/course.controller');

// Get all categories
router.get('/categories', getCategories);

// Get all boards
router.get('/boards', getBoards);

// Get states by board ID
router.get('/states/:boardId', getStatesByBoard);

// Get mediums by state ID
router.get('/mediums/:stateId', getMediumsByState);

// Get all exams
router.get('/exams', getExams);

// Get all streams
router.get('/streams', getStreams);

// Get all terms
router.get('/terms', getTerms);

module.exports = router;

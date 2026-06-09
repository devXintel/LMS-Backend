const express = require('express');
const router = express.Router();
const academicProfileController = require('../controllers/academicProfile.controller');

// Get academic profile by user ID
router.get('/:userId', academicProfileController.getAcademicProfile);

// Save/update complete academic profile
router.post('/save', academicProfileController.saveAcademicProfile);

// Update class level (for class 1-12 selection)


// Update board selection (CBSE, ICSE, IGCSE, State Board)
router.post('/board', academicProfileController.updateBoardSelection);

// Update exam type (for "others" selection - NEET, JEE, UPSC, Banking, etc.)
router.post('/exam-type', academicProfileController.updateExamType);

// Update state and medium (for state board selection)
router.post('/state-medium', academicProfileController.updateStateAndMedium);
router.post('/stream', academicProfileController.updateStream);

// Reset academic profile (Restart Enrollment)
router.post('/reset', academicProfileController.resetAcademicProfile);

// Multi-profile Enrollment endpoints
router.get('/all/:userId', academicProfileController.getAllEnrollments);
router.post('/switch', academicProfileController.switchEnrollment);

module.exports = router;

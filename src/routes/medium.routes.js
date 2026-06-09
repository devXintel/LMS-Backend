const express = require('express');
const router = express.Router();
const mediumController = require('../controllers/medium.controller');

// Get all mediums
router.get('/', mediumController.getAllMediums);

// Create medium
router.post('/', mediumController.createMedium);

// Delete medium
router.delete('/:id', mediumController.deleteMedium);

module.exports = router;

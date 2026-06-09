const express = require('express');
const router = express.Router();
const streamController = require('../controllers/stream.controller');

// Get all streams
router.get('/', streamController.getAllStreams);

// Create stream
router.post('/', streamController.createStream);

// Delete stream
router.delete('/:id', streamController.deleteStream);

module.exports = router;

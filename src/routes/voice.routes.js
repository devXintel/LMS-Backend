const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voice.controller');

// GET /api/voice/active
router.get('/active', voiceController.getActiveVoice);

// POST /api/voice/tts
router.post('/tts', voiceController.synthesize);

module.exports = router;

const express = require('express');
const router = express.Router();
const { synthesizeIndic } = require('../controllers/indicTts.controller');

// POST /api/tts/indic
// Body: { text, language, subtopicId }
// Returns: { success, url }
router.post('/indic', synthesizeIndic);

module.exports = router;

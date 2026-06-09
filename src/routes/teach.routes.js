const express = require('express');
const router = express.Router();
const { teach, preGenerate } = require('../controllers/teach.controller');

// POST /teach
// Body: { subject, chapter, userMessage, history? }
router.post('/', teach);

// POST /teach/pre-generate
// Body: { subject, chapter, subtopics, audience }
router.post('/pre-generate', preGenerate);

module.exports = router;

const express = require('express');
const router = express.Router();
const embeddingController = require('../controllers/embedding.controller');

// Route to generate embeddings for a PDF on S3
router.post('/generate', embeddingController.generateEmbeddings);

module.exports = router;

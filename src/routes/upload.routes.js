const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');

// Route to get a presigned URL for uploading
router.post('/presigned-url', uploadController.getPresignedUrl);

module.exports = router;

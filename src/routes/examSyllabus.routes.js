const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME } = require('../config/s3.config');
const {
    uploadSyllabus,
    getSyllabi,
    deleteSyllabus,
    updateSyllabus,
    getChaptersByExamName,
    extractSyllabusChapters
} = require('../controllers/examSyllabus.controller');

// Configure Multer for S3
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'syllabus/exam/' + uniqueSuffix + '-' + file.originalname);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Routes
router.post('/upload', uploadSyllabus);
router.get('/', getSyllabi);
// Specific named routes MUST come before wildcard /:id routes
router.get('/chapters/:examName', getChaptersByExamName);
router.post('/extract/:id', extractSyllabusChapters);
router.put('/:id', updateSyllabus);
router.delete('/:id', deleteSyllabus);

module.exports = router;

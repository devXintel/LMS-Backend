const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME } = require('../config/s3.config');
const subjectSyllabusController = require('../controllers/subjectSyllabus.controller');

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
            cb(null, 'syllabus/subject/' + uniqueSuffix + '-' + file.originalname);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for syllabus'), false);
        }
    }
});

// Subject Syllabus Routes
router.post('/upload', subjectSyllabusController.uploadSyllabus);
router.get('/chapters', subjectSyllabusController.getChaptersByProfile);
router.put('/:id', subjectSyllabusController.updateSyllabus);
router.get('/', subjectSyllabusController.getSyllabi);
router.delete('/:id', subjectSyllabusController.deleteSyllabus);

module.exports = router;

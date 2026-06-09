const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME, REGION } = require('../config/s3.config');

// Filter for images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};

// Use multer-s3 to stream directly to S3 under the 'profile-pic/' folder
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = file.originalname.split('.').pop();
            cb(null, `profilepic/avatar-${uniqueSuffix}.${ext}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB
    },
    fileFilter: fileFilter
});

module.exports = upload;

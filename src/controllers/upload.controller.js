const { generateUploadUrl } = require('../utils/s3.utils');

const getPresignedUrl = async (req, res) => {
    try {
        const { fileName, fileType, folder } = req.body;

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'fileName and fileType are required' });
        }

        const data = await generateUploadUrl(fileName, fileType, folder);

        res.json(data);
    } catch (error) {
        console.error('Error in getPresignedUrl:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};

module.exports = {
    getPresignedUrl
};

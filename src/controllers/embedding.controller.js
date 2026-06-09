const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { uploadFolderToS3, deleteFileFromS3 } = require('../utils/s3.utils');

/**
 * Trigger embedding generation for a syllabus
 * 1. Download PDF from S3 to temp
 * 2. Run Python script to generate FAISS index
 * 3. Upload FAISS folder to S3
 * 4. Cleanup
 */
const generateEmbeddings = async (req, res) => {
    const { syllabusId, pdfUrl, folderName } = req.body;

    if (!pdfUrl || !folderName) {
        return res.status(400).json({ error: 'pdfUrl and folderName are required' });
    }

    const tempDir = path.join(__dirname, '../../temp_embeddings', Date.now().toString());
    const tempPdfPath = path.join(tempDir, 'syllabus.pdf');
    const outputDir = path.join(tempDir, 'output');

    try {
        // Ensure temp directories exist
        fs.mkdirSync(tempDir, { recursive: true });

        // 1. Download PDF from S3
        console.log(`Downloading PDF from S3: ${pdfUrl}`);
        const response = await axios({
            method: 'get',
            url: pdfUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempPdfPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 2. Spawning Python script
        console.log(`Running Python script for embeddings...`);
        const pythonScriptPath = path.normalize(path.join(__dirname, '../../create_embeddings.py'));
        const command = `py -3 "${pythonScriptPath}" --pdf_path "${tempPdfPath}" --output_dir "${outputDir}"`;

        console.log(`Command: ${command}`);
        console.log(`CWD: ${process.cwd()}`);

        try {
            await new Promise((resolve, reject) => {
                exec(command, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout, stderr) => {
                    if (stdout) console.log(`Python Output:\n${stdout}`);
                    if (error) {
                        console.error(`Python Exec Error: ${error}`);
                        if (stderr) console.error(`Python Stderr:\n${stderr}`);
                        return reject(error);
                    }
                    resolve();
                });
            });
        } catch (err) {
            throw err;
        }

        // 3. Uploading FAISS folder to S3
        const s3EmbeddingPrefix = `embeddings/${folderName}`;
        console.log(`Uploading FAISS index to S3: ${s3EmbeddingPrefix}`);
        await uploadFolderToS3(outputDir, s3EmbeddingPrefix);

        // 4. Update Database
        const prisma = require('../config/prisma');
        const type = req.body.type || 'subject'; // default to subject
        const { BUCKET_NAME, REGION } = require('../config/s3.config');

        const faissKey = `${s3EmbeddingPrefix}/index.faiss`;
        const pklKey = `${s3EmbeddingPrefix}/index.pkl`;

        // Construct full public URLs
        const faissUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${faissKey}`;
        const pklUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${pklKey}`;

        if (type === 'subject') {
            await prisma.subjectSyllabus.update({
                where: { id: parseInt(syllabusId) },
                data: {
                    embedded: faissUrl,
                    originalFile: pklUrl
                }
            });
        } else if (type === 'exam') {
            await prisma.examSyllabus.update({
                where: { id: parseInt(syllabusId) },
                data: {
                    embedded: faissUrl,
                    originalFile: pklUrl
                }
            });
        }

        res.json({
            message: 'Embeddings generated and uploaded successfully',
            s3Path: s3EmbeddingPrefix,
            faissUrl,
            pklUrl
        });

    } catch (error) {
        console.error('Error in generateEmbeddings:', error);
        res.status(500).json({ error: 'Failed to generate embeddings' });
    } finally {
        // 4. Cleanup temp files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
};

module.exports = {
    generateEmbeddings
};

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { extractChaptersFromPdfUrl } = require('./src/services/ai-syllabus.service');
const fs = require('fs');

const BUCKET_NAME = "ai-lms-storage";
const REGION = process.env.AWS_REGION || "us-east-1";
const s3Client = new S3Client({ region: REGION });

async function run() {
    try {
        console.log("Listing S3 bucket:", BUCKET_NAME);
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME
        });

        const response = await s3Client.send(command);
        if (!response.Contents || response.Contents.length === 0) {
            console.log("No files found in S3 bucket!");
            return;
        }

        // Sort by LastModified descending
        const sorted = response.Contents.sort((a, b) => b.LastModified - a.LastModified);
        
        // Find latest PDF
        const latestPdf = sorted.find(file => file.Key.toLowerCase().endsWith('.pdf'));

        if (!latestPdf) {
            console.log("No PDF found in S3 bucket!");
            return;
        }

        const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${latestPdf.Key}`;
        console.log("Found latest uploaded syllabus:", publicUrl);

        console.log("Running AI Syllabus extraction on it...");
        const chapters = await extractChaptersFromPdfUrl(publicUrl);
        
        fs.writeFileSync('s3_syllabus_result.json', JSON.stringify({ url: publicUrl, chapters }, null, 2));
        console.log("Extraction complete! Check s3_syllabus_result.json");
    } catch (err) {
        console.error("Error:", err);
    }
}

run();

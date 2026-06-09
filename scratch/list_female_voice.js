const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const BUCKET_NAME = "ai-lms-storage";
const REGION = "us-east-1";
const s3Client = new S3Client({ region: REGION });

async function run() {
    try {
        console.log("Listing S3 bucket:", BUCKET_NAME);
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: "female_voice/"
        });

        const response = await s3Client.send(command);
        if (!response.Contents || response.Contents.length === 0) {
            console.log("No files found in 'female_voice/' folder!");
            return;
        }

        response.Contents.forEach(file => {
            console.log(`Key: ${file.Key}, Size: ${file.Size}`);
        });
    } catch (err) {
        console.error("Error:", err);
    }
}

run();

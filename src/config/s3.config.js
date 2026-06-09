const { S3Client } = require("@aws-sdk/client-s3");

/**
 * AWS S3 Configuration
 * 
 * IMPORTANT: No S3 details are stored in .env as per requirements.
 * The S3Client will automatically use the default credential provider chain:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. Shared credentials file (~/.aws/credentials)
 * 3. IAM role for EC2/Lambda
 */

// REGION and BUCKET_NAME are defined as constants here to avoid .env usage.

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "ai-lms-storage";

const s3Client = new S3Client({
    region: REGION
});

module.exports = {
    s3Client,
    BUCKET_NAME,
    REGION
};

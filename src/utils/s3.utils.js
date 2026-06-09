const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client, BUCKET_NAME } = require("../config/s3.config");
const fs = require('fs');
const path = require('path');

/**
 * Generate a presigned URL for uploading a file to S3
 * @param {string} fileName - The name of the file
 * @param {string} fileType - The MIME type of the file
 * @param {string} folder - The subfolder in S3 (default: 'uploads')
 * @returns {Promise<{uploadUrl: string, key: string, publicUrl: string}>}
 */
const generateUploadUrl = async (fileName, fileType, folder = 'uploads') => {
    // Create a unique key for the file (timestamp + clean filename)
    const key = `${folder}/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: fileType
    });

    try {
        // Generate pre-signed URL (valid for 5 minutes)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        const { REGION } = require("../config/s3.config");
        const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;

        return {
            uploadUrl,
            key,
            publicUrl
        };
    } catch (error) {
        console.error("Error generating pre-signed URL:", error);
        throw error;
    }
};

/**
 * Upload a local file directly to S3
 * @param {string} localPath - Absolute path to local file
 * @param {string} s3Key - The key (path) in S3
 */
const uploadFileToS3 = async (localPath, s3Key) => {
    const fileContent = fs.readFileSync(localPath);
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent
    });

    try {
        await s3Client.send(command);
        console.log(`Successfully uploaded ${localPath} to S3 bucket ${BUCKET_NAME} as ${s3Key}`);
        const { REGION } = require("../config/s3.config");
        return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${s3Key}`;
    } catch (err) {
        console.error("Error uploading file to S3:", err);
        throw err;
    }
};

/**
 * Recursively upload a folder to S3
 * @param {string} localDirPath - Local directory path
 * @param {string} s3FolderPrefix - S3 folder prefix
 */
const uploadFolderToS3 = async (localDirPath, s3FolderPrefix) => {
    console.log(`Starting folder upload from ${localDirPath} to ${s3FolderPrefix}`);
    const files = fs.readdirSync(localDirPath);

    for (const file of files) {
        const localPath = path.join(localDirPath, file);
        const s3Key = `${s3FolderPrefix}/${file}`;

        if (fs.lstatSync(localPath).isDirectory()) {
            await uploadFolderToS3(localPath, s3Key);
        } else {
            console.log(`Uploading file to S3: ${s3Key}`);
            await uploadFileToS3(localPath, s3Key);
        }
    }
    console.log(`Successfully uploaded folder to S3: ${s3FolderPrefix}`);
};

/**
 * Delete a file from S3 given its full URL or Key
 * @param {string} fileUrlOrKey - The full S3 URL or the object Key
 */
const deleteFileFromS3 = async (fileUrlOrKey) => {
    // ... (rest of the existing delete logic)
    console.log("deleteFileFromS3 called with:", fileUrlOrKey);
    if (!fileUrlOrKey) return;

    let key = fileUrlOrKey;
    // Attempt to extract key if full URL is passed
    if (fileUrlOrKey.startsWith('http')) {
        try {
            const url = new URL(fileUrlOrKey);
            // ONLY proceed if the host looks like an S3 host (e.g. bucket.s3.region.amazonaws.com)
            if (!url.hostname.includes('amazonaws.com')) {
                console.log("Not an S3 URL, skipping deletion logic:", fileUrlOrKey);
                return;
            }

            // S3 URL format: https://bucket.s3.amazonaws.com/KEY
            // Pathname will be /KEY
            // OR https://s3.region.amazonaws.com/BUCKET/KEY
            if (url.pathname.startsWith('/' + BUCKET_NAME)) {
                key = url.pathname.replace('/' + BUCKET_NAME + '/', '');
            } else {
                // If it doesn't start with bucket name, it might be the key directly (virtual hosted style)
                // e.g. /uploads/file.pdf
                // Remove leading slash if present
                key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
            }
            // Decode URI component to handle spaces (%20) -> ( ) because S3 keys are stored decoded
            key = decodeURIComponent(key);
            console.log("Extracted S3 Key:", key);
        } catch (e) {
            console.error("Error parsing S3 URL for deletion:", e);
            return;
        }
    }

    try {
        console.log("Sending DeleteObjectCommand for key:", key);
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        await s3Client.send(command);
        console.log(`Successfully deleted file from S3: ${key}`);
    } catch (error) {
        console.error(`Error deleting S3 file (${key}):`, error);
    }
};

/**
 * Delete a folder (prefix) from S3
 * @param {string} s3FolderPrefix - The prefix (folder) to delete
 */
const deleteFolderFromS3 = async (s3FolderPrefix) => {
    if (!s3FolderPrefix) return;

    // Ensure prefix ends with a slash to avoid deleting a/b-c when deleting a/b
    const folderPrefix = s3FolderPrefix.endsWith('/') ? s3FolderPrefix : `${s3FolderPrefix}/`;

    try {
        const { ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

        // 1. List all objects in the folder
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: folderPrefix
        });

        const listResponse = await s3Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log(`No objects found in S3 folder: ${folderPrefix}`);
            return;
        }

        // 2. Delete all objects
        const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
                Objects: listResponse.Contents.map(obj => ({ Key: obj.Key }))
            }
        });

        await s3Client.send(deleteCommand);
        console.log(`Successfully deleted S3 folder and its contents: ${folderPrefix}`);
    } catch (error) {
        console.error(`Error deleting S3 folder (${folderPrefix}):`, error);
    }
};

/**
 * Extract S3 Key from a full public URL
 * @param {string} urlString 
 * @returns {string|null}
 */
const getS3KeyFromUrl = (urlString) => {
    if (!urlString || !urlString.startsWith('http')) return urlString;
    try {
        const url = new URL(urlString);
        const { BUCKET_NAME } = require("../config/s3.config");

        // Handle virtual hosted style: https://bucket.s3.region.amazonaws.com/KEY
        // pathname will be /KEY
        let key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;

        // Handle path style: https://s3.region.amazonaws.com/bucket/KEY
        if (key.startsWith(BUCKET_NAME + '/')) {
            key = key.substring(BUCKET_NAME.length + 1);
        }

        return decodeURIComponent(key);
    } catch (e) {
        return null;
    }
};

module.exports = {
    generateUploadUrl,
    deleteFileFromS3,
    uploadFileToS3,
    uploadFolderToS3,
    deleteFolderFromS3,
    getS3KeyFromUrl
};

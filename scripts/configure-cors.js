const { PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const { s3Client, BUCKET_NAME } = require("../src/config/s3.config");

const run = async () => {
    console.log(`Configuring CORS for bucket: ${BUCKET_NAME}`);

    const command = new PutBucketCorsCommand({
        Bucket: BUCKET_NAME,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
                    AllowedOrigins: ["*"], // For development; restrict to valid domains in prod
                    ExposeHeaders: ["ETag"],
                    MaxAgeSeconds: 3000
                }
            ]
        }
    });

    try {
        await s3Client.send(command);
        console.log("Successfully configured CORS!");
    } catch (err) {
        console.error("Error configuring CORS:", err);
    }
};

run();

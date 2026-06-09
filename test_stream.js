require('ts-node/register');
require('dotenv').config({ path: require('path').join(__dirname, '../lms-ai/.env') });
const { getTeachingResponseStream } = require('../lms-ai/services/teach');

async function test() {
    try {
        console.log("Starting test...");
        console.log("API KEY starts with:", process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.substring(0, 10) : "MISSING");
        const stream = getTeachingResponseStream({
            subject: "Physics",
            chapter: "LAWS OF MOTION",
            subtopic: "Newton's First Law",
            userMessage: "start",
            isLecture: true,
            language: "tamil"
        });

        console.log("Consuming stream...");
        for await (const chunk of stream) {
            process.stdout.write(chunk);
        }
        console.log("\nTest finished successfully.");
    } catch (err) {
        console.error("\n[CRITICAL TEST FAILURE]");
        console.error("Error Message:", err.message);
        console.error("Stack Trace:", err.stack);
    }
}

test();

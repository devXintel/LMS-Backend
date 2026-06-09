require('ts-node/register');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });
const { getTeachingResponseStream } = require('../lms-ai/services/teach');

async function test() {
    try {
        console.log("Calling getTeachingResponseStream with updated MODELS...");
        const stream = getTeachingResponseStream({
            subject: 'Physics',
            chapter: 'Laws of Motion',
            userMessage: 'start',
            history: []
        });

        let chunkCount = 0;
        for await (const chunk of stream) {
            process.stdout.write(chunk);
            chunkCount++;
            if (chunkCount > 20) break; // just test the first 20 chunks
        }
        console.log("\n\n✅ Stream started successfully!");
    } catch (err) {
        console.error("\n❌ ERROR:", err.message);
    }
}
test();

require('ts-node/register');
require('dotenv').config();
const app = require('./src/app');
const ttsService = require('./src/services/tts.service');

const port = process.env.PORT || 5000;

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    
    // Pre-initialize Kokoro engine in the background
    ttsService.init().catch(err => {
        console.error("[TTS Warmup] Failed to initialize on startup:", err.message);
    });
});

// Force restart for Prisma Client update

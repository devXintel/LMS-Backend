const fs = require('fs');
const path = require('path');

let KokoroTTS;

// Force HuggingFace to use a stable project-local cache dir.
// This keeps the model out of node_modules where npm can corrupt it.
const MODEL_CACHE_DIR = path.join(__dirname, '../../models/kokoro_cache');
process.env.HF_HOME = MODEL_CACHE_DIR;
process.env.TRANSFORMERS_CACHE = MODEL_CACHE_DIR;

class TTSService {
    constructor() {
        this.tts = null;
        this.modelId = "onnx-community/Kokoro-82M-v1.0-ONNX";
        this.cacheDir = path.join(__dirname, '../../public/audio');
        this.generatingSet = new Set();
    }

    async init() {
        if (this.tts) return;
        try {
            console.log("[TTS Service] Initializing Kokoro TTS engine...");
            if (!KokoroTTS) {
                const module = await import('kokoro-js');
                KokoroTTS = module.KokoroTTS;
            }

            console.log("[TTS Service] Loading weights for " + this.modelId + `. On the first run, this downloads ~100MB to ${MODEL_CACHE_DIR}.`);
            this.tts = await KokoroTTS.from_pretrained(this.modelId, {
                dtype: "q8",
                device: "cpu",
                cache_dir: MODEL_CACHE_DIR,
            });
            console.log("[TTS Service] Kokoro TTS successfully initialized! 🎙️");
        } catch (err) {
            console.error("[TTS Service] FATAL: Failed to load Kokoro TTS:", err);
            console.error(`[TTS Service] TIP: Delete the model cache at '${MODEL_CACHE_DIR}' and restart to force a fresh download.`);
            throw err;
        }
    }

    /**
     * Generates or retrieves cached audio for a given text.
     */
    async generate(text, _voice, subtopicId, language = 'english') {
        await this.init();

        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        const VOICE = 'bf_isabella'; // Switch to clear British female voice
        const safeId = subtopicId.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        const langSuffix = language === 'tamil' ? '_ta' : '_en';
        const fileName = `${safeId}${langSuffix}_bf_isabella.wav`;
        const filePath = path.join(this.cacheDir, fileName);

        if (fs.existsSync(filePath)) {
            return `/audio/${fileName}`;
        }

        if (this.generatingSet.has(fileName)) {
            while (this.generatingSet.has(fileName)) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            return `/audio/${fileName}`;
        }

        this.generatingSet.add(fileName);

        try {
            const audio = await this.tts.generate(text, {
                voice: VOICE,
                speed: 1.0,
            });
            
            await audio.save(filePath);
            
            return `/audio/${fileName}`;
        } catch (err) {
            console.error("[TTS Service] ERROR during generation:", err);
            throw err;
        } finally {
            this.generatingSet.delete(fileName);
        }
    }
}

module.exports = new TTSService();

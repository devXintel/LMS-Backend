const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const INDIC_TTS_SCRIPT = path.join(__dirname, '../../../ai/services/indic_tts.py');
const AUDIO_DIR = path.join(__dirname, '../../public/audio/indic');

// Ensure indic audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Supported Indic languages
const SUPPORTED_LANGS = new Set(['ta', 'te', 'ml', 'kn', 'hi']);

/**
 * POST /api/tts/indic
 * Body: { text: string, language: string, subtopicId: string }
 * Returns: { success: true, url: '/audio/indic/file.mp3' }
 *
 * Generates female-voiced Indian language TTS using gTTS.
 * Checks file cache first — avoids regenerating the same subtopic audio.
 */
exports.synthesizeIndic = async (req, res) => {
    const { text, language, subtopicId } = req.body;

    if (!text || !language) {
        return res.status(400).json({ success: false, error: 'text and language are required.' });
    }

    if (!SUPPORTED_LANGS.has(language)) {
        return res.status(400).json({
            success: false,
            error: `Unsupported language: ${language}. Supported: ${[...SUPPORTED_LANGS].join(', ')}`
        });
    }

    // Build a safe cache filename
    const safeId = (subtopicId || 'chunk')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .slice(0, 80);
    const fileName = `${language}_${safeId}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);
    const publicUrl = `/audio/indic/${fileName}`;

    // ── Cache hit ──────────────────────────────────────────────────────────
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
        console.log(`[IndicTTS] Cache HIT: ${fileName}`);
        return res.json({ success: true, url: publicUrl, cached: true });
    }

    // ── Generate via Python gTTS script ───────────────────────────────────
    console.log('--- Tamil Debug: Audio Generation ---');
    console.log('Indic TTS called with:', { text: text.slice(0, 50) + '...', language, subtopicId });
    console.log(`[IndicTTS] Generating ${language} audio for: "${text.slice(0, 60)}..."`);

    const args = [
        INDIC_TTS_SCRIPT,
        '--text',   text,
        '--lang',   language,
        '--output', filePath,
    ];

    return new Promise((resolve) => {
        execFile('python', args, { timeout: 30_000 }, (error, stdout, stderr) => {
            if (error) {
                console.error('[IndicTTS] Python error:', error.message);
                console.error('[IndicTTS] stderr:', stderr);

                // ── Fallback: try pyttsx3 or return error gracefully ──────
                return resolve(
                    res.status(500).json({
                        success: false,
                        error: 'Indic TTS generation failed.',
                        detail: error.message,
                        stderr: stderr?.slice(0, 300),
                    })
                );
            }

            let result;
            try {
                result = JSON.parse(stdout.trim());
            } catch (parseErr) {
                console.error('[IndicTTS] Failed to parse Python output:', stdout);
                return resolve(
                    res.status(500).json({ success: false, error: 'Invalid response from TTS script.' })
                );
            }

            if (!result.success) {
                console.error('[IndicTTS] Python script error:', result.error);
                return resolve(
                    res.status(500).json({ success: false, error: result.error })
                );
            }

            console.log(`[IndicTTS] Generated: ${fileName} (${result.size} bytes)`);
            return resolve(res.json({ success: true, url: publicUrl, cached: false }));
        });
    });
};

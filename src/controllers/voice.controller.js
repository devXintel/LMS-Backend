const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ttsService = require('../services/tts.service');

/**
 * GET /api/voice/active
 * Returns the active female voice sample S3 path from the database.
 */
exports.getActiveVoice = async (req, res) => {
    try {
        // Find the female voice sample
        const voice = await prisma.voiceSample.findUnique({
            where: { voiceName: 'Female Voice Sample' }
        });

        if (!voice) {
            return res.status(404).json({ 
                success: false, 
                message: 'No active female voice sample found in database.' 
            });
        }

        res.json({
            success: true,
            voice: {
                name: voice.voiceName,
                gender: voice.gender,
                s3Path: voice.s3Path
            }
        });
    } catch (error) {
        console.error('Error fetching active voice:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching voice configuration.',
            error: error.message 
        });
    }
};

/**
 * POST /api/voice/tts
 * Synthesizes speech using kokoro-js and built-in voices.
 */
exports.synthesize = async (req, res) => {
    const { text, subtopicId, language = 'english' } = req.body;

    if (!text || !subtopicId) {
        return res.status(400).json({ success: false, message: 'Text and subtopicId are required.' });
    }

    try {
        // Always use af_heart — the premium Kokoro female voice.
        const voice = 'af_heart';
        
        const audioUrl = await ttsService.generate(text, voice, subtopicId, language);
        
        res.json({
            success: true,
            url: audioUrl
        });
    } catch (error) {
        console.error('TTS Controller Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to synthesize speech.',
            error: error.message 
        });
    }
};

/**
 * teach.controller.js
 * Handles AI teaching sessions using the new ContentNode / LessonCache architecture.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../ai/.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const util = require('util');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const execFilePromise = util.promisify(execFile);

const { getTeachingResponseStream, generateKeypointsOnly, isApologyText } = require('../../../ai/services/teach');
const ttsService = require('../services/tts.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 80);
}

const INDIC_LANGS = ['tamil', 'ta', 'telugu', 'te', 'malayalam', 'ml', 'kannada', 'kn', 'hindi', 'hi'];

function isIndicLanguage(lang) {
    return INDIC_LANGS.includes((lang || '').toLowerCase());
}

function isErrorContent(text) {
    if (!text) return true;
    const lower = text.toLowerCase();
    return lower.includes("api issues") ||
        lower.includes("failed to respond") ||
        lower.includes("trouble connecting to my brain") ||
        lower.includes("i apologize");
}

const INDIC_TTS_SCRIPT = path.join(__dirname, '../../../ai/services/indic_tts.py');
const AUDIO_DIR = path.join(__dirname, '../../public/audio/indic');

if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function getWavDuration(filePath) {
    const buffer = fs.readFileSync(filePath);
    const fmtIndex = buffer.indexOf('fmt ');
    if (fmtIndex === -1) throw new Error('Not a valid WAV file');
    const byteRate = buffer.readUInt32LE(fmtIndex + 8 + 8);
    const dataIndex = buffer.indexOf('data');
    if (dataIndex === -1) throw new Error('No data chunk found in WAV');
    const dataSize = buffer.readUInt32LE(dataIndex + 4);
    return dataSize / byteRate;
}

function getMp3Duration(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        let duration = 0;
        let offset = 0;
        const length = buffer.length;

        while (offset < length - 4) {
            if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xE0) === 0xE0) {
                const b1 = buffer[offset + 1];
                const b2 = buffer[offset + 2];

                const version_id = (b1 & 0x18) >> 3; // 3 = v1, 2 = v2, 0 = v2.5
                const layer = (b1 & 0x06) >> 1;     // 1 = Layer III

                if (layer === 1) {
                    const bitrate_index = (b2 & 0xF0) >> 4;
                    const sample_rate_index = (b2 & 0x0C) >> 2;
                    const padding = (b2 & 0x02) >> 1;

                    let bitrates;
                    if (version_id === 3) { // MPEG v1
                        bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
                    } else { // MPEG v2 or v2.5
                        bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
                    }

                    let sample_rates;
                    if (version_id === 3) { // MPEG v1
                        sample_rates = [44100, 48000, 32000, 0];
                    } else if (version_id === 2) { // MPEG v2
                        sample_rates = [22050, 24000, 16000, 0];
                    } else if (version_id === 0) { // MPEG v2.5
                        sample_rates = [11025, 12000, 8000, 0];
                    } else {
                        sample_rates = [0, 0, 0, 0];
                    }

                    const bitrate = bitrates[bitrate_index] ? bitrates[bitrate_index] * 1000 : 0;
                    const sample_rate = sample_rates[sample_rate_index] || 0;

                    if (bitrate > 0 && sample_rate > 0) {
                        let frame_size;
                        let samples_per_frame;
                        if (version_id === 3) {
                            frame_size = Math.floor(144 * bitrate / sample_rate) + padding;
                            samples_per_frame = 1152;
                        } else {
                            frame_size = Math.floor(72 * bitrate / sample_rate) + padding;
                            samples_per_frame = 576;
                        }

                        if (frame_size > 0) {
                            duration += samples_per_frame / sample_rate;
                            offset += frame_size;
                            continue;
                        }
                    }
                }
            }
            offset++;
        }
        return duration || (buffer.length / 4000);
    } catch (err) {
        console.error('[Duration] Parser error:', err);
        return 0;
    }
}

function robustParseJSONLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Attempt 1: Standard JSON parse
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch (e) {
        // Fall through to regex recovery
    }

    // Attempt 2: Loose/regex-based key-value extraction for resilient recovery
    let text = "";
    let keyword = "";
    let keyPoint = "";

    // Extract text
    const textMatch = trimmed.match(/"text"\s*:\s*"([^"]+)"/) || trimmed.match(/"text"\s*:\s*([^,}\n]+)/);
    if (textMatch) {
        text = textMatch[1].replace(/^"/, '').replace(/"$/, '').trim();
    } else {
        const looseTextMatch = trimmed.match(/text\s*:\s*"([^"]+)"/) || trimmed.match(/text\s*:\s*([^,}\n]+)/);
        if (looseTextMatch) text = looseTextMatch[1].replace(/^"/, '').replace(/"$/, '').trim();
    }

    // Extract keyword
    const keywordMatch = trimmed.match(/"keyword"\s*:\s*"([^"]+)"/) || trimmed.match(/"keyword"\s*:\s*([^,}\n]+)/);
    if (keywordMatch) {
        keyword = keywordMatch[1].replace(/^"/, '').replace(/"$/, '').trim();
    } else {
        const looseKeywordMatch = trimmed.match(/keyword\s*:\s*"([^"]+)"/) || trimmed.match(/keyword\s*:\s*([^,}\n]+)/) || trimmed.match(/"keyword:\s*([^"]+)"/);
        if (looseKeywordMatch) keyword = looseKeywordMatch[1].replace(/^"/, '').replace(/"$/, '').trim();
    }

    // Extract keyPoint
    const keyPointMatch = trimmed.match(/"keyPoint"\s*:\s*"([^"]+)"/) || trimmed.match(/"keyPoint"\s*:\s*([^,}\n]+)/);
    if (keyPointMatch) {
        keyPoint = keyPointMatch[1].replace(/^"/, '').replace(/"$/, '').trim();
    } else {
        const looseKeyPointMatch = trimmed.match(/keyPoint\s*:\s*"([^"]+)"/) || trimmed.match(/keyPoint\s*:\s*([^,}\n]+)/) || trimmed.match(/"keyPoint:\s*([^"]+)"/);
        if (looseKeyPointMatch) keyPoint = looseKeyPointMatch[1].replace(/^"/, '').replace(/"$/, '').trim();
    }

    if (text) {
        return { text, keyword, keyPoint };
    }
    return null;
}

async function enrichLessonWithAudiosAndTimestamps(segments, subtopic, language) {
    const isIndic = isIndicLanguage(language);
    const safeSubtopicId = slugify(subtopic || 'lesson');

    const langMap = {
        'english': 'en', 'tamil': 'ta', 'telugu': 'te',
        'malayalam': 'ml', 'kannada': 'kn', 'hindi': 'hi',
        'en': 'en', 'ta': 'ta', 'te': 'te', 'ml': 'ml', 'kn': 'kn', 'hi': 'hi'
    };
    const langCode = langMap[language.toLowerCase()] || 'en';

    if (!isIndic) {
        let cumulativeTime = 0;
        const enriched = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const text = seg.text;
            const chunkId = `${safeSubtopicId}_${i}`;
            
            // Generate exact audio for this specific chunk
            const audioUrl = await ttsService.generate(text, 'bf_isabella', chunkId, 'english');
            const audioPath = path.join(__dirname, '../../public', audioUrl);
            
            let duration = 0;
            try {
                duration = getWavDuration(audioPath);
            } catch (err) {
                console.error('[Enrich] Failed to parse WAV duration:', err);
                duration = text.length / 13;
            }

            const startTime = cumulativeTime;
            const endTime = startTime + duration;
            cumulativeTime = endTime;

            enriched.push({
                text: seg.text,
                keyword: seg.keyword,
                keyPoint: seg.keyPoint || '',
                startTime: parseFloat(startTime.toFixed(3)),
                endTime: parseFloat(endTime.toFixed(3)),
                audioUrl: audioUrl
            });
        }
        return enriched;
    } else {
        let cumulativeTime = 0;
        const enriched = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const text = seg.text;
            const chunkId = `${safeSubtopicId}_${i}`;
            const fileName = `${langCode}_${chunkId}.mp3`;
            const filePath = path.join(AUDIO_DIR, fileName);
            const publicUrl = `/audio/indic/${fileName}`;

            let duration = 0;
            let cached = false;
            if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
                cached = true;
            } else {
                duration = await new Promise((resolve) => {
                    const args = [INDIC_TTS_SCRIPT, '--text', text, '--lang', langCode, '--output', filePath];
                    execFile('python', args, { timeout: 30000 }, (err, stdout) => {
                        if (err) {
                            console.error(`[Enrich] ${language} segment[${i}] generation failed:`, err);
                            resolve(0);
                        } else {
                            try {
                                const res = JSON.parse(stdout.trim());
                                if (res.success && res.duration) {
                                    resolve(res.duration);
                                } else {
                                    resolve(0);
                                }
                            } catch (e) {
                                resolve(0);
                            }
                        }
                    });
                });
            }

            if (duration <= 0) {
                if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
                    try {
                        duration = getMp3Duration(filePath);
                    } catch (err) {
                        console.error('[Enrich] Failed to parse MP3 duration:', err);
                        duration = text.length / 7;
                    }
                } else {
                    duration = text.length / 7;
                }
            }

            const startTime = cumulativeTime;
            const endTime = startTime + duration;
            cumulativeTime = endTime;

            enriched.push({
                text: seg.text,
                keyword: seg.keyword,
                keyPoint: seg.keyPoint || '',
                startTime: parseFloat(startTime.toFixed(3)),
                endTime: parseFloat(endTime.toFixed(3)),
                audioUrl: publicUrl
            });
        }
        return enriched;
    }
}


const REJECT_URL_TERMS = [
    'page', 'text', 'written', 'handwritten', 'manuscript',
    'document', 'paper', 'article', 'journal', 'publication',
    'printed', 'scan', 'scanned', 'book', 'chapter', 'paragraph',
    'table', 'chart', 'graph', 'formula', 'equation', 'notes',
    'blackboard', 'whiteboard', 'chalkboard', 'handout',
    'worksheet', 'exercise', 'problem', 'question', 'answer',
    'thumb/220', 'thumb/200', 'thumb/180', 'thumb/160',
    '.pdf', 'Page_', 'Page-', 'Seite_', 'folio', 'recto', 'verso'
];

function isRejectedUrl(url) {
    if (!url) return true;
    const lower = url.toLowerCase();
    for (const term of REJECT_URL_TERMS) {
        if (lower.includes(term.toLowerCase())) return true;
    }
    return false;
}

function isRejectedCategory(categories) {
    if (!categories) return false;
    const lower = categories.toLowerCase();
    const rejectTerms = ['diagrams of text', 'book pages', 'scanned pages', 'manuscripts', 'written documents'];
    for (const term of rejectTerms) {
        if (lower.includes(term)) return true;
    }
    return false;
}

function getPollinationsFallback(keyword, subject) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1a1a2e"/>
                <stop offset="100%" stop-color="#16213e"/>
            </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bg)"/>

        <circle cx="400" cy="220" r="100"
                fill="white"
                fill-opacity="0.08"/>

        <text x="400"
              y="300"
              font-family="Arial"
              font-size="42"
              font-weight="bold"
              fill="white"
              text-anchor="middle">
            ${keyword}
        </text>

        <text x="400"
              y="350"
              font-family="Arial"
              font-size="24"
              fill="#b8c1ff"
              text-anchor="middle">
            ${subject || ""}
        </text>
    </svg>`;

    return "data:image/svg+xml;base64," +
        btoa(unescape(encodeURIComponent(svg)));
}

/**
 * Fetch a relevant image from Wikipedia/Wikimedia based on a keyword.
 */
async function fetchWikipediaImage(keyword, subject) {
    if (!keyword || keyword.length < 2) return getPollinationsFallback(keyword, subject);

    const searches = [
        `${keyword} diagram`,
        `${keyword} ${subject || ''} diagram`.trim(),
        `${keyword} illustration`,
        `${keyword} ${subject || ''} chart`.trim()
    ];

    for (const searchTitle of searches) {
        try {
            // Step 1: Search for matching pages
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTitle)}&utf8=&format=json&origin=*`;
            const searchRes = await axios.get(searchUrl);
            const searchResults = searchRes.data?.query?.search;

            if (!searchResults || searchResults.length === 0) continue;

            const pageTitle = searchResults[0].title;

            // Step 2: Get imageinfo for the page
            const mwUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|images&titles=${encodeURIComponent(pageTitle)}&format=json&pithumbsize=800&origin=*`;
            const res = await axios.get(mwUrl);
            const pages = res.data?.query?.pages;

            if (pages) {
                const pageId = Object.keys(pages)[0];
                const pageData = pages[pageId];

                if (pageId !== "-1" && pageData.thumbnail?.source) {
                    const imgUrl = pageData.thumbnail.source;
                    const width = pageData.thumbnail.width;
                    const height = pageData.thumbnail.height;

                    if (isRejectedUrl(imgUrl)) continue;

                    if (width < 300 || height < 200) continue;

                    const ratio = width / height;
                    if (ratio < 0.8) continue; // Reject portrait images

                    // Check extmetadata to ensure it's not a scanned page
                    const imgTitle = pageData.pageimage ? `File:${pageData.pageimage}` : null;
                    if (imgTitle) {
                        const metaUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(imgTitle)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`;
                        const metaRes = await axios.get(metaUrl);
                        const metaPages = metaRes.data?.query?.pages;
                        if (metaPages) {
                            const metaPageId = Object.keys(metaPages)[0];
                            const extMeta = metaPages[metaPageId]?.imageinfo?.[0]?.extmetadata;
                            if (extMeta && extMeta.Categories && isRejectedCategory(extMeta.Categories.value)) {
                                continue; // Reject based on category
                            }
                        }
                    }

                    return imgUrl;
                }
            }
        } catch (err) {
            console.error(`[Wiki] Error fetching image for ${searchTitle}:`, err.message);
        }
    }

    // Fallback to Pollinations if all Wikipedia attempts fail
    return getPollinationsFallback(keyword, subject);
}

/**
 * Extract keywords from JSONL lesson content and fetch their images.
 */
async function generateVisualAids(fullContent, subject) {
    const lines = fullContent.split('\n');
    const visualData = { keywords: [], urls: [] };
    const processedKeywords = new Set();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const json = JSON.parse(trimmed);
            const keyword = json.keyword;
            if (keyword && !processedKeywords.has(keyword)) {
                processedKeywords.add(keyword);
                const url = await fetchWikipediaImage(keyword, subject);
                visualData.keywords.push(keyword);
                visualData.urls.push(url || '');
            }
        } catch {
            // Skip invalid lines
        }
    }
    return visualData;
}

/**
 * Resolve or create the ContentNode leaf for the given subject/chapter/subtopic.
 * Returns the node's id.
 */
async function resolveContentNode({ subject, chapter, subtopic }) {
    const subjectSlug = slugify(subject);
    const chapterSlug = slugify(chapter);
    const subtopicSlug = subtopic ? slugify(subtopic) : null;

    // SUBJECT (root)
    let subjectNode = await prisma.contentNode.findFirst({
        where: { slug: subjectSlug, parentId: null },
    });
    if (!subjectNode) {
        subjectNode = await prisma.contentNode.create({
            data: { name: subject, slug: subjectSlug, type: 'SUBJECT', parentId: null, isActive: true },
        });
    }

    // CHAPTER
    let chapterNode = await prisma.contentNode.findFirst({
        where: { slug: chapterSlug, parentId: subjectNode.id },
    });
    if (!chapterNode) {
        chapterNode = await prisma.contentNode.create({
            data: { name: chapter, slug: chapterSlug, type: 'CHAPTER', parentId: subjectNode.id, isActive: true },
        });
    }

    // SUBTOPIC (optional)
    if (subtopic && subtopicSlug && subtopic.toLowerCase() !== chapter.toLowerCase()) {
        let subtopicNode = await prisma.contentNode.findFirst({
            where: { slug: subtopicSlug, parentId: chapterNode.id },
        });
        if (!subtopicNode) {
            subtopicNode = await prisma.contentNode.create({
                data: { name: subtopic, slug: subtopicSlug, type: 'SUBTOPIC', parentId: chapterNode.id, isActive: true },
            });
        }
        return subtopicNode.id;
    }

    return chapterNode.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// TTS Warmup
// ─────────────────────────────────────────────────────────────────────────────

const warmupTTSCache = async (fullText, subtopicName, language = 'english') => {
    try {
        const safeId = (subtopicName || "lecture").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const voice = 'bf_isabella';

        const chunks = fullText.split('\n').filter(val => val.trim().length > 0);

        for (let i = 0; i < chunks.length; i++) {
            try {
                const json = JSON.parse(chunks[i]);
                if (json.text) {
                    await ttsService.generate(json.text, voice, `${safeId}_${i}`, language);
                }
            } catch {
                const cleanText = chunks[i].replace(/[#*_~`]/g, '').trim();
                if (cleanText) {
                    await ttsService.generate(cleanText, voice, `${safeId}_${i}`, language);
                }
            }
        }
    } catch (err) {
        console.warn("[Warmup] Failed to initiate:", err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Main teach handler
// ─────────────────────────────────────────────────────────────────────────────

async function getOrGenerateVisuals(content, subject, nodeId, langCode) {
    if (langCode !== 'en') {
        try {
            const enCache = await prisma.lessonCache.findUnique({
                where: { contentNodeId_language: { contentNodeId: nodeId, language: 'en' } }
            });
            if (enCache && enCache.visualUrls && enCache.visualUrls.length > 0) {
                console.log(`[Cache] Reusing English visuals for lang=${langCode}`);
                return { keywords: enCache.visualKeywords, urls: enCache.visualUrls };
            }
        } catch (e) {
            console.warn(`[Cache] Failed to lookup English visuals for reuse: ${e.message}`);
        }
    }
    return await generateVisualAids(content, subject);
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory guard: tracks lessons currently being enriched in the background.
// When a second /teach request arrives for the same lesson while enrichment is
// running, we return 202 instead of triggering a new AI generation.
// ─────────────────────────────────────────────────────────────────────────────
const enrichingSet = new Set();

const teach = async (req, res) => {
    try {
        const {
            subject, chapter, subtopic, userMessage,
            syllabusId, history = [], audience, language = 'english',
            contentNodeId: explicitNodeId
        } = req.body;

        if (!subject || !chapter || !userMessage) {
            return res.status(400).json({ error: 'subject, chapter, and userMessage are required.' });
        }

        const isLecture = userMessage.toLowerCase().trim() === 'start' && history.length === 0;

        const langMap = {
            'english': 'en', 'tamil': 'ta', 'telugu': 'te',
            'malayalam': 'ml', 'kannada': 'kn', 'hindi': 'hi',
            'en': 'en', 'ta': 'ta', 'te': 'te', 'ml': 'ml', 'kn': 'kn', 'hi': 'hi'
        };
        const langCode = langMap[language.toLowerCase()] || 'en';


        // ── 1. Cache Check (DB is best-effort — outage → graceful cache miss) ──
        // All languages (including Tamil) are handled by the general cache block below
        // which includes proper enrichment (audioUrl, startTime, endTime) needed for teaching.
        if (isLecture) {
            try {
                const nodeId = explicitNodeId ?? await resolveContentNode({ subject, chapter, subtopic });
                console.log(`[Cache] Looking up nodeId=${nodeId} lang=${langCode}`);

                const cached = await prisma.lessonCache.findUnique({
                    where: { contentNodeId_language: { contentNodeId: nodeId, language: langCode } },
                });

                if (cached) {
                    console.log(`[Cache] HIT ✔ (id=${cached.id}, ${cached.lessonText.length} chars)`);

                    // Check if cached lesson is already enriched
                    let isEnriched = false;
                    try {
                        const firstLine = cached.lessonText.split('\n')[0].trim();
                        if (firstLine) {
                            const parsed = JSON.parse(firstLine);
                            if (parsed.startTime !== undefined && parsed.audioUrl !== undefined) {
                                isEnriched = true;
                            }
                        }
                    } catch (e) { }

                    if (!isEnriched) {
                        const enrichKey = `${langCode}:${subject}:${chapter}:${subtopic || ''}`;
                        if (enrichingSet.has(enrichKey)) {
                            // Background TTS enrichment is already running — serve raw content now.
                            // The enriched version will be available on the next visit.
                            console.log(`[Cache] Pending cache — TTS enrichment in progress. Serving raw content.`);
                        } else {
                            // Server was restarted mid-enrichment (enrichingSet cleared) — restart enrichment
                            // asynchronously and serve raw content immediately without blocking.
                            console.log(`[Cache] Pending cache (server restarted?) — restarting TTS enrichment in background.`);
                            enrichingSet.add(enrichKey);
                            ;(async () => {
                                try {
                                    const lines = cached.lessonText.split('\n');
                                    const segments = [];
                                    for (const line of lines) {
                                        const trimmed = line.trim();
                                        if (!trimmed) continue;
                                        try {
                                            const parsed = robustParseJSONLine(trimmed);
                                            if (parsed && parsed.text) segments.push(parsed);
                                        } catch (e) { }
                                    }
                                    if (segments.length > 0) {
                                        const enriched = await enrichLessonWithAudiosAndTimestamps(segments, subtopic || chapter, language);
                                        const enrichedContent = enriched.map(s => JSON.stringify(s)).join('\n');
                                        await prisma.lessonCache.update({
                                            where: { id: cached.id },
                                            data: { lessonText: enrichedContent, status: 'generated' }
                                        });
                                        console.log(`[Cache] ✔ Background re-enrichment complete (id=${cached.id})`);
                                    }
                                } catch (err) {
                                    console.error(`[Cache] ✘ Background re-enrichment failed:`, err.message);
                                } finally {
                                    enrichingSet.delete(enrichKey);
                                }
                            })();
                        }
                    }

                    // Back-fill visuals if missing (non-blocking)
                    if (!cached.visualKeywords || !cached.visualUrls) {
                        getOrGenerateVisuals(cached.lessonText, subject, nodeId, langCode).then(async (visuals) => {
                            await prisma.lessonCache.update({
                                where: { id: cached.id },
                                data: { visualKeywords: visuals.keywords, visualUrls: visuals.urls },
                            });
                        }).catch(() => { }); // ignore DB errors here
                    }

                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.json({
                        content: cached.lessonText,
                        visualKeywords: cached.visualKeywords || [],
                        visualUrls: cached.visualUrls || [],
                        contentNodeId: nodeId,
                        keyPoints: cached.keyPoints ? (typeof cached.keyPoints === 'string' ? JSON.parse(cached.keyPoints) : cached.keyPoints) : null,
                        language: cached.language,
                    });
                }

                console.log(`[Cache] MISS ✖ Generating from AI…`);
            } catch (dbErr) {
                // DB is unreachable (e.g. Neon sleeping) — treat as cache miss and stream from AI
                console.warn(`[Cache] DB unavailable — skipping cache lookup and streaming from AI. Reason: ${dbErr.message}`);
            }

            // ── Guard: if this lesson is currently being enriched in the background,
            // return 202 so the frontend knows to wait instead of triggering a new
            // AI generation (which would get rate-limited and return an apology).
            const enrichKey = `${langCode}:${subject}:${chapter}:${subtopic || ''}`;
            if (enrichingSet.has(enrichKey)) {
                console.log(`[Cache] Lesson ${enrichKey} is being enriched — returning 202 to client.`);
                res.setHeader('Content-Type', 'application/json');
                return res.status(202).json({ enriching: true, message: 'Lesson is being prepared, please retry shortly.' });
            }
        }

        // ── 2. S3 Embedding Lookup (best-effort — DB failure → skip context) ──
        let embeddedContext = null;
        if (isLecture && syllabusId) {
            try {
                let syllabus = await prisma.examSyllabus.findUnique({
                    where: { id: parseInt(syllabusId) },
                    select: { embedded: true },
                });
                if (!syllabus) {
                    syllabus = await prisma.subjectSyllabus.findUnique({
                        where: { id: parseInt(syllabusId) },
                        select: { embedded: true },
                    });
                }
                if (syllabus?.embedded) {
                    const focusTopic = subtopic || chapter;
                    try {
                        const scriptPath = path.join(__dirname, '../../query_embeddings.py');
                        const { stdout, stderr } = await execFilePromise(
                            'py', ['-3', scriptPath, '--s3_url', syllabus.embedded, '--query', focusTopic],
                            { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
                        );
                        if (stderr) console.warn('Python stderr:', stderr);
                        const result = JSON.parse(stdout.trim().split('\n').pop());
                        if (result.success && result.results?.length > 0) {
                            embeddedContext = result.results.join('\n\n---\n\n');
                        }
                    } catch (err) {
                        console.error('Error executing query_embeddings.py:', err);
                    }
                }
            } catch (dbErr) {
                console.warn(`[Embeddings] DB unavailable — skipping syllabus context. Reason: ${dbErr.message}`);
            }
        }

        // ── 3. Stream AI Response ──────────────────────────────────────────
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        let finalUserMessage = userMessage;
        if (isLecture && embeddedContext) {
            finalUserMessage = `${userMessage}\n\n[CONTEXT FROM SYLLABUS]:\n${embeddedContext}\n\nIMPORTANT RESTRICTION: The syllabus context above is ONLY for your background knowledge. DO NOT read it out loud. DO NOT list or mention the other topics from the syllabus. ONLY teach about "**${subtopic || chapter}**". Start teaching immediately without reading the syllabus.`;
        }

        const stream = getTeachingResponseStream({
            subject, chapter, subtopic, isLecture,
            userMessage: finalUserMessage,
            history, audience, language,
        });

        let fullContent = "";
        for await (const chunk of stream) {
            res.write(chunk);
            if (isLecture) fullContent += chunk;
        }
        res.end();

        if (isLecture) {
            console.log('--- Tamil Debug: Lesson Generation ---');
            console.log('Tamil lesson length:', fullContent?.length);
            console.log('Tamil lesson text (first 200 chars):', fullContent?.slice(0, 200));
            if (!fullContent || fullContent.trim().length < 50) {
                console.error('Tamil generation failed - text too short or empty');
            }
        }

        // ── 4. Save to Cache (best-effort — DB failure just means no cache) ──
        const isErrorResponse = isErrorContent(fullContent);
        const isApology = isApologyText(fullContent);

        // Abort cache save if apology or error detected
        if (isLecture && (isErrorResponse || isApology)) {
            console.error('[Cache] Apology or error detected, skipping cache save');
            // Do not attempt to send a response here as streaming may have already completed.
        }

        if (isLecture && fullContent.trim() && !isErrorResponse && !isApology) {
            const enrichKey = `${langCode}:${subject}:${chapter}:${subtopic || ''}`;

            // ── PHASE 1: Save raw lesson text immediately ─────────────────────
            // This ensures the lesson is cached even if TTS enrichment fails or
            // the server restarts during background enrichment.  The 'pending'
            // status tells the cache hit handler to re-enrich on the next visit.
            let savedNodeId = null;
            try {
                savedNodeId = explicitNodeId ?? await resolveContentNode({ subject, chapter, subtopic });
                await prisma.lessonCache.upsert({
                    where: { contentNodeId_language: { contentNodeId: savedNodeId, language: langCode } },
                    update:  { lessonText: fullContent, status: 'pending' },
                    create:  { contentNodeId: savedNodeId, language: langCode, lessonText: fullContent, status: 'pending',
                               visualKeywords: [], visualUrls: [] },
                });
                console.log(`[Cache] ✔ Raw lesson saved (pending enrichment) nodeId=${savedNodeId} lang=${langCode} chars=${fullContent.length}`);
            } catch (saveErr) {
                console.error('[Cache] ✘ Failed to save raw lesson to DB:', saveErr.message);
            }

            // ── PHASE 2: Enrich with TTS audio in background ─────────────────
            // Runs as a fire-and-forget IIFE so res.end() is not blocked.
            enrichingSet.add(enrichKey);
            ;(async () => {
            try {
                const nodeId = savedNodeId ?? (explicitNodeId ?? await resolveContentNode({ subject, chapter, subtopic }));
                console.log(`[Cache] ⚙ Starting TTS enrichment: nodeId=${nodeId} lang=${langCode}`);

                // Parse segments and generate per-segment audio
                const lines = fullContent.split('\n');
                const segments = [];
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = robustParseJSONLine(trimmed);
                        if (parsed && parsed.text) segments.push(parsed);
                    } catch (e) { }
                }
                console.log(`[Cache] Parsed ${segments.length} segments for TTS enrichment`);

                let enrichedContent = fullContent;
                if (segments.length > 0) {
                    try {
                        const enriched = await enrichLessonWithAudiosAndTimestamps(segments, subtopic || chapter, language);
                        enrichedContent = enriched.map(s => JSON.stringify(s)).join('\n');
                        console.log(`[Cache] ✔ TTS enrichment complete: ${enriched.length} segments`);
                    } catch (err) {
                        console.error('[Cache] ✘ TTS enrichment failed — raw lesson stays in cache:', err.message);
                        // Raw lesson is already in DB (from Phase 1), so this is safe to skip
                        enrichingSet.delete(enrichKey);
                        return;
                    }
                }

                const visuals = await getOrGenerateVisuals(enrichedContent, subject, nodeId, langCode);

                await prisma.lessonCache.upsert({
                    where: { contentNodeId_language: { contentNodeId: nodeId, language: langCode } },
                    update: {
                        lessonText: enrichedContent,
                        visualKeywords: visuals.keywords,
                        visualUrls: visuals.urls,
                        status: 'generated',
                    },
                    create: {
                        contentNodeId: nodeId,
                        language: langCode,
                        lessonText: enrichedContent,
                        visualKeywords: visuals.keywords,
                        visualUrls: visuals.urls,
                        status: 'generated',
                    },
                });
                console.log(`[Cache] ✔ Enriched lesson saved to DB: nodeId=${nodeId} lang=${langCode}`);
                enrichingSet.delete(enrichKey);

                // Asynchronously generate the alternative language (non-blocking) with full enrichment
                const backgroundLanguage = language === 'tamil' ? 'english' : 'tamil';
                const bgLangCode = langMap[backgroundLanguage.toLowerCase()] || 'en';

                prisma.lessonCache.findFirst({
                    where: { contentNodeId: nodeId, language: bgLangCode }
                }).then(bgCached => {
                    if (!bgCached) {
                        console.log(`[Cache Warmup] Starting generation for nodeId=${nodeId} lang=${bgLangCode}`);
                        (async () => {
                            try {
                                const bgStream = getTeachingResponseStream({
                                    subject, chapter, subtopic, isLecture,
                                    userMessage: finalUserMessage,
                                    history, audience, language: backgroundLanguage,
                                });
                                let bgContent = "";
                                for await (const chunk of bgStream) {
                                    bgContent += chunk;
                                }
                                if (bgContent.trim() && !isErrorContent(bgContent)) {
                                    // Parse and enrich before saving (same as primary language path)
                                    const bgLines = bgContent.split('\n');
                                    const bgSegments = [];
                                    for (const line of bgLines) {
                                        const trimmed = line.trim();
                                        if (!trimmed) continue;
                                        try {
                                            const parsed = robustParseJSONLine(trimmed);
                                            if (parsed && parsed.text) bgSegments.push(parsed);
                                        } catch (e) { }
                                    }
                                    let bgEnrichedContent = bgContent;
                                    if (bgSegments.length > 0) {
                                        try {
                                            const bgEnriched = await enrichLessonWithAudiosAndTimestamps(bgSegments, subtopic || chapter, backgroundLanguage);
                                            bgEnrichedContent = bgEnriched.map(s => JSON.stringify(s)).join('\n');
                                            console.log(`[Cache Warmup] Enriched ${bgSegments.length} segments for lang=${bgLangCode}`);
                                        } catch (enrichErr) {
                                            console.error(`[Cache Warmup] Enrichment failed for lang=${bgLangCode}:`, enrichErr.message);
                                        }
                                    }
                                    const bgVisuals = await getOrGenerateVisuals(bgEnrichedContent, subject, nodeId, bgLangCode);
                                    await prisma.lessonCache.upsert({
                                        where: { contentNodeId_language: { contentNodeId: nodeId, language: bgLangCode } },
                                        update: { lessonText: bgEnrichedContent, visualKeywords: bgVisuals.keywords, visualUrls: bgVisuals.urls, status: 'generated' },
                                        create: { contentNodeId: nodeId, language: bgLangCode, lessonText: bgEnrichedContent, visualKeywords: bgVisuals.keywords, visualUrls: bgVisuals.urls, status: 'generated' }
                                    });
                                    console.log(`[Cache Warmup] Saved enriched alt-lang lesson for nodeId=${nodeId} lang=${bgLangCode}`);
                                }
                            } catch (bgErr) {
                                console.error(`[Cache Warmup] Background generation failed for lang=${bgLangCode}:`, bgErr);
                            }
                        })();
                    }
                }).catch(err => console.warn('[Cache Warmup] DB unavailable:', err.message));

            } catch (cacheErr) {
                // DB is unreachable after streaming — lesson was served successfully, just not cached
                enrichingSet.delete(enrichKey);
                console.warn(`[Cache] DB unavailable — lesson streamed but not saved to cache. Reason: ${cacheErr.message}`);
            }
            })(); // end enrichment IIFE — runs fully in background after response is sent
        }

    } catch (err) {
        console.error('teach controller error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: `Internal server error: ${err.message}` });
        }
        res.end();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-generation handler
// ─────────────────────────────────────────────────────────────────────────────

const preGenerate = async (req, res) => {
    try {
        const { subject, chapter, subtopics, syllabusId, audience, language = 'english' } = req.body;

        if (!subject || !chapter || !subtopics || !Array.isArray(subtopics)) {
            return res.status(400).json({ error: 'subject, chapter, and subtopics (array) are required.' });
        }

        const languages = ['english', 'tamil', 'telugu', 'malayalam', 'kannada', 'hindi'];
        const langMap = {
            'english': 'en', 'tamil': 'ta', 'telugu': 'te',
            'malayalam': 'ml', 'kannada': 'kn', 'hindi': 'hi'
        };

        for (const sub of subtopics) {
            const subtopicName = typeof sub === 'string' ? sub : sub.name;
            const nodeId = await resolveContentNode({ subject, chapter, subtopic: subtopicName });

            for (const lang of languages) {
                const langCode = langMap[lang] || 'en';

                // Skip if already cached
                const cached = await prisma.lessonCache.findUnique({
                    where: { contentNodeId_language: { contentNodeId: nodeId, language: langCode } },
                });
                if (cached && cached.lessonText && cached.lessonText.trim().length > 100) {
                    // console.log(`[Pre-Gen] Skipping ${subtopicName} (${langCode}) - already cached.`);
                    continue;
                }

                console.log(`[Pre-Gen] Generating ${subtopicName} (${langCode})...`);
                const stream = getTeachingResponseStream({
                    subject, chapter,
                    subtopic: subtopicName,
                    isLecture: true,
                    userMessage: "start",
                    history: [],
                    audience, language: lang,
                });

                let fullContent = "";
                try {
                    for await (const chunk of stream) {
                        fullContent += chunk;
                    }

                    if (fullContent.trim() && !isErrorContent(fullContent)) {
                        const lines = fullContent.split('\n');
                        const segments = [];
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed) continue;
                            try {
                                const parsed = robustParseJSONLine(trimmed);
                                if (parsed && parsed.text) segments.push(parsed);
                            } catch (e) { }
                        }

                        let enrichedContent = fullContent;
                        if (segments.length > 0) {
                            try {
                                const enriched = await enrichLessonWithAudiosAndTimestamps(segments, subtopicName, lang);
                                enrichedContent = enriched.map(s => JSON.stringify(s)).join('\n');
                            } catch (enrichErr) {
                                console.error(`[Pre-Gen] Enrichment failed for ${subtopicName} (${langCode}):`, enrichErr.message);
                            }
                        }

                        const visuals = await generateVisualAids(enrichedContent);
                        await prisma.lessonCache.upsert({
                            where: { contentNodeId_language: { contentNodeId: nodeId, language: langCode } },
                            update: {
                                lessonText: enrichedContent,
                                visualKeywords: visuals.keywords,
                                visualUrls: visuals.urls,
                                status: 'generated',
                                generatedAt: new Date(),
                            },
                            create: {
                                contentNodeId: nodeId,
                                language: langCode,
                                lessonText: enrichedContent,
                                visualKeywords: visuals.keywords,
                                visualUrls: visuals.urls,
                                status: 'generated',
                            },
                        });
                        console.log(`[Pre-Gen] Saved ${subtopicName} (${langCode}).`);
                    }
                } catch (err) {
                    console.error(`[Pre-Gen] Failed for ${subtopicName} (${langCode}):`, err.message);
                }
            }
        }

        res.json({ success: true, message: "Pre-generation complete" });

    } catch (err) {
        console.error('preGenerate error:', err);
        res.status(500).json({ error: err.message });
    }
};

const getKeypointsOnly = async (req, res) => {
    try {
        const { subtopicId, language, lessonText } = req.body;

        if (!subtopicId || !language) {
            return res.status(400).json({ error: 'subtopicId and language are required.' });
        }

        const langMap = {
            'english': 'en', 'tamil': 'ta', 'telugu': 'te',
            'malayalam': 'ml', 'kannada': 'kn', 'hindi': 'hi',
            'en': 'en', 'ta': 'ta', 'te': 'te', 'ml': 'ml', 'kn': 'kn', 'hi': 'hi'
        };
        const langCode = langMap[language.toLowerCase()] || 'en';
        const contentNodeId = parseInt(subtopicId);

        // 1. Checks DB for existing keypoints
        const cached = await prisma.lessonCache.findUnique({
            where: { contentNodeId_language: { contentNodeId, language: langCode } }
        });

        if (cached && cached.keyPoints) {
            let keypointsList = cached.keyPoints;
            if (typeof keypointsList === 'string') {
                try {
                    keypointsList = JSON.parse(keypointsList);
                } catch (e) { }
            }
            console.log(`[Keypoints API] Cache HIT for nodeId=${contentNodeId} lang=${langCode}`);
            return res.json({ keyPoints: keypointsList, source: 'cache' });
        }

        // 2. If null -> generate using language-specific prompt
        console.log(`[Keypoints API] Cache MISS or keyPoints is null for nodeId=${contentNodeId} lang=${langCode}. Generating...`);
        const textToUse = lessonText || (cached ? cached.lessonText : "");
        if (!textToUse) {
            return res.status(400).json({ error: 'lessonText is required to generate keypoints because cache was not found.' });
        }

        try {
            const generatedKeypoints = await generateKeypointsOnly(language, textToUse);

            // 3. Save to DB
            if (cached) {
                await prisma.lessonCache.update({
                    where: { id: cached.id },
                    data: { keyPoints: generatedKeypoints }
                });
            } else {
                await prisma.lessonCache.create({
                    data: {
                        contentNodeId,
                        language: langCode,
                        lessonText: textToUse,
                        keyPoints: generatedKeypoints,
                        status: 'generated'
                    }
                });
            }

            console.log(`[Keypoints API] Generated and saved for nodeId=${contentNodeId} lang=${langCode}`);
            return res.json({ keyPoints: generatedKeypoints, source: 'generated' });

        } catch (err) {
            console.warn(`[Keypoints API] Failed to generate keypoints for nodeId=${contentNodeId} lang=${langCode}. Falling back to English keypoints...`, err);
            // 4. If ALL keypoint generation fails: Fall back to English keypoints from English cache
            try {
                const enCache = await prisma.lessonCache.findUnique({
                    where: { contentNodeId_language: { contentNodeId, language: 'en' } }
                });
                if (enCache && enCache.keyPoints) {
                    let enKeypointsList = enCache.keyPoints;
                    if (typeof enKeypointsList === 'string') {
                        enKeypointsList = JSON.parse(enKeypointsList);
                    }
                    console.log(`[Keypoints API] Successfully fell back to English keypoints for nodeId=${contentNodeId}`);
                    return res.json({ keyPoints: enKeypointsList, source: 'english-fallback' });
                }
            } catch (fallbackErr) {
                console.error(`[Keypoints API] English fallback failed:`, fallbackErr);
            }
            return res.json({ keyPoints: [], source: 'failed' });
        }

    } catch (err) {
        console.error('getKeypointsOnly error:', err);
        return res.status(500).json({ error: err.message });
    }
};

module.exports = { teach, preGenerate, getKeypointsOnly };

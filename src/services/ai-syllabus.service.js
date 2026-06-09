const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../ai/.env') });
const PDFParser = require("pdf2json");
const axios = require('axios');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'ai-lms-storage';

/**
 * Download a file from S3 (private bucket) using AWS SDK.
 * Falls back to plain axios for public URLs.
 */
async function downloadFile(url) {
    // Check if it's an S3 URL for our private bucket
    const s3Match = url.match(/https?:\/\/([^.]+)\.s3[^/]*\.amazonaws\.com\/(.+)/);
    if (s3Match) {
        const bucket = s3Match[1];
        const key = decodeURIComponent(s3Match[2]);
        console.log(`Downloading from private S3: bucket=${bucket} key=${key}`);
        const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
        const resp = await s3Client.send(cmd);
        // Convert readable stream to buffer
        const chunks = [];
        for await (const chunk of resp.Body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    // Plain public URL
    console.log('Downloading from public URL:', url);
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(resp.data);
}

/**
 * Extract raw text from PDF buffer using pdf2json
 */
function extractTextFromPdf(pdfBuffer) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, 1);
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
            resolve(pdfParser.getRawTextContent());
        });
        pdfParser.parseBuffer(pdfBuffer);
    });
}

/**
 * Parse the raw PDF text into structured subjects → chapters → subtopics.
 *
 * Strategy:
 * 1. Split text into "pages" on the ----------Page Break---------- marker.
 * 2. Find subject headings (PHYSICS, CHEMISTRY, BIOLOGY, MATHEMATICS, etc.)
 * 3. Find UNIT/CHAPTER headers within each subject's text block.
 * 4. Treat the body text between consecutive unit headers as the unit's content.
 * 5. Extract subtopics from that body: split on commas/semicolons, then clean.
 */
function parseSyllabusFromText(rawText) {
    // ─── 1. Clean up the raw text ────────────────────────────────────────────
    // Remove page-break markers and eOffice footer noise
    let text = rawText
        .replace(/----------------Page \(\d+\) Break----------------/g, '\n')
        .replace(/Generated from eOffice by .+/g, '')
        .replace(/File No\.[^\n]+/g, '')
        .replace(/DFA\/\d+[^\n]+/g, '')
        .replace(/\d+\s*\n\s*\d+/g, '\n')   // stray page numbers
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')             // collapse spaces
        .replace(/\n{3,}/g, '\n\n');         // collapse excessive blank lines

    // ─── 2. Identify known subjects ──────────────────────────────────────────
    // We look for lines that are ONLY the subject name (possibly with spaces around)
    const SUBJECT_PATTERNS = [
        { label: 'Physics',     regex: /^PHYSICS\s*$/m },
        { label: 'Chemistry',   regex: /^CHEMISTRY\s*$/m },
        { label: 'Biology',     regex: /^BIOLOGY\s*$/m },
        { label: 'Mathematics', regex: /^MATHEMATICS\s*$/m },
        { label: 'Botany',      regex: /^BOTANY\s*$/m },
        { label: 'Zoology',     regex: /^ZOOLOGY\s*$/m },
    ];

    // Find each subject's start position
    const foundSubjects = [];
    for (const sp of SUBJECT_PATTERNS) {
        const m = sp.regex.exec(text);
        if (m) {
            foundSubjects.push({ label: sp.label, index: m.index });
        }
    }
    foundSubjects.sort((a, b) => a.index - b.index);

    if (foundSubjects.length === 0) {
        console.log('No subjects found in PDF text — returning null');
        return null;
    }

    // ─── 3. Extract per-subject text block ───────────────────────────────────
    const result = [];

    for (let si = 0; si < foundSubjects.length; si++) {
        const subj = foundSubjects[si];
        const blockStart = subj.index;
        const blockEnd = si + 1 < foundSubjects.length
            ? foundSubjects[si + 1].index
            : text.length;

        const subjectBlock = text.slice(blockStart, blockEnd);

        // ─── 4. Find UNIT/CHAPTER headings inside the block ──────────────────
        // Matches: "UNIT 1: SOME TITLE" or "UNIT 2 SOME TITLE" or "UNIT I:" etc.
        // Also matches "CHAPTER 1 ..." and "1. Something" bullet style (fallback)
        const unitHeaderRegex = /(?:^|\n)\s*(?:UNIT|CHAPTER)\s*[\dIVXivx]+\s*[:\-–]?\s*([A-Z][^\n]{3,80})/g;

        const unitMatches = [];
        let m;
        while ((m = unitHeaderRegex.exec(subjectBlock)) !== null) {
            unitMatches.push({
                title: m[1].trim(),
                startInBlock: m.index + m[0].indexOf(m[1])
            });
        }

        if (unitMatches.length === 0) {
            console.log(`No units found for subject: ${subj.label}`);
            continue;
        }

        // ─── 5. Extract body text for each unit and parse subtopics ──────────
        const chapters = [];
        for (let ui = 0; ui < unitMatches.length; ui++) {
            const unit = unitMatches[ui];
            const bodyStart = unit.startInBlock + unit.title.length;
            const bodyEnd = ui + 1 < unitMatches.length
                ? unitMatches[ui + 1].startInBlock
                : subjectBlock.length;

            const bodyText = subjectBlock.slice(bodyStart, bodyEnd)
                .replace(/\n+/g, ' ')     // flatten to one line for splitting
                .replace(/\s+/g, ' ')
                .trim();

            const subtopics = extractSubtopicsFromBody(bodyText, unit.title);

            chapters.push({
                name: cleanChapterTitle(unit.title),
                subtopics
            });
        }

        result.push({ subject: subj.label, chapters });
    }

    return result.length > 0 ? result : null;
}

/**
 * Parse subtopics from a chapter's body paragraph.
 * Strategy: split on comma or semicolon, then trim and filter short/junk tokens.
 */
function extractSubtopicsFromBody(bodyText, chapterTitle) {
    if (!bodyText || bodyText.trim().length < 10) {
        return [`Introduction to ${cleanChapterTitle(chapterTitle)}`];
    }

    // Remove the UNIT/CHAPTER bleedthrough at the end of a body block
    // e.g. "... and its applications. UNIT 6" → remove "UNIT 6"
    let cleaned = bodyText
        .replace(/\bUNIT\s*[\dIVX]+\b/gi, '')
        .replace(/\bCHAPTER\s*[\dIVX]+\b/gi, '')
        .replace(/\bUNITS\s*[\dIVX]+\b/gi, '')
        // Remove eOffice / file ref noise
        .replace(/\d+\s*\/\s*\d+\s*\/\s*UGMEB\s*[-–]\s*NMC\s*\d*/gi, '')
        .replace(/4565948\/\d+\/UGMEB\s*[-–]\s*NMC/gi, '')
        // Remove bullet-style numbering "1. Foo" → " Foo"
        .replace(/\b\d+\.\s+/g, ', ')
        .replace(/\(i\)|\(ii\)|\(iii\)|\(iv\)|\(v\)/gi, ',')
        .replace(/•/g, ',')
        .replace(/\s*;\s*/g, ',')
        // Collapse whitespace and normalize commas
        .replace(/\s*,\s*/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

    const raw = cleaned.split(',');

    // Common stopwords to reject standalone tokens
    const STOPWORDS = new Set([
        'and','or','the','of','in','its','to','a','an','by','from','for','with',
        'as','at','on','be','is','are','was','were','that','this','it','not',
        'but','also','into','onto','through','over','under','above','below',
        'between','among','within','without','during','before','after','since',
        'until','while','if','when','where','which','who','whom','whose','how',
        'their','they','them','then','so','yet','both','each','few','more',
        'most','other','some','such','p','d','f','s','g'
    ]);

    const subtopics = raw
        .map(s => s.trim())
        .filter(s => {
            if (s.length < 5) return false;           // too short
            if (s.length > 130) return false;         // too long (paragraph noise)
            if (/^\d+$/.test(s)) return false;        // pure number
            if (/^\d+\s*[a-z]?$/.test(s)) return false; // number + single letter
            if (STOPWORDS.has(s.toLowerCase())) return false; // stopword
            // Reject strings that start with a number-only pattern (page refs)
            if (/^\d{4,}/.test(s)) return false;
            return true;
        })
        .map(s => {
            // Title-case the first letter only
            return s.charAt(0).toUpperCase() + s.slice(1);
        });

    // Deduplicate (case-insensitive)
    const seen = new Set();
    const unique = subtopics.filter(s => {
        const key = s.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return unique.length > 0
        ? unique
        : [`Introduction to ${cleanChapterTitle(chapterTitle)}`];
}

function cleanChapterTitle(title) {
    return title
        .split(':').pop()   // strip "UNIT X:" prefix if any
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Main entry: Download PDF from URL and extract structured syllabus.
 * Returns: [{subject, chapters:[{name, subtopics:[]}]}] or null on failure.
 */
async function extractChaptersFromPdfUrl(pdfUrl) {
    try {
        console.log(`Downloading PDF for extraction: ${pdfUrl}`);
        const fileBuffer = await downloadFile(pdfUrl);

        console.log(`Extracting text from PDF...`);
        const rawText = await extractTextFromPdf(fileBuffer);

        if (!rawText || rawText.trim() === '') {
            console.error('Extracted text is empty');
            return null;
        }

        console.log(`Extracted ${rawText.length} characters. Parsing structure...`);
        const structured = parseSyllabusFromText(rawText);

        if (structured) {
            structured.forEach(s => {
                console.log(`  ${s.subject}: ${s.chapters.length} chapters`);
            });
        } else {
            console.warn('Could not parse structured syllabus from PDF text');
        }

        return structured;

    } catch (error) {
        console.error('Error extracting chapters:', error.message || error);
        return null;
    }
}

module.exports = {
    extractChaptersFromPdfUrl
};

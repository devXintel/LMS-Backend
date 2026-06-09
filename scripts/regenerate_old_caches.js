/**
 * regenerate_old_caches.js
 * ─────────────────────────
 * Finds LessonCache rows whose lessonText is NOT valid JSONL,
 * calls the AI to re-generate them in the new JSONL format,
 * and saves them back.
 *
 * Usage:
 *   node scripts/regenerate_old_caches.js [--dry-run]
 *
 * --dry-run  prints which rows need regeneration without calling the AI.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../lms-ai/.env') });
const { PrismaClient } = require('@prisma/client');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const path = require('path');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// teach.ts is TypeScript — call it via the existing controller which already requires it
// Instead, we'll call the backend /teach endpoint directly for regeneration
const axios = require('axios');
const BACKEND = 'http://localhost:5000';


/** Returns true if the string has at least 3 valid JSONL lines with a .text field */
function isJsonl(text) {
    const lines = (text || '').split('\n').filter(l => l.trim());
    let count = 0;
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            if (obj.text) count++;
            if (count >= 3) return true;
        } catch { /* not JSON */ }
    }
    return false;
}

/** Walk up to find subject + chapter + subtopic names from ContentNode tree */
async function resolveNodePath(nodeId) {
    const parts = { subject: '', chapter: '', subtopic: '' };
    let node = await prisma.contentNode.findUnique({ where: { id: nodeId } });
    if (!node) return null;

    const chain = [node];
    while (node.parentId) {
        node = await prisma.contentNode.findUnique({ where: { id: node.parentId } });
        if (node) chain.unshift(node);
    }

    // chain: [SUBJECT, CHAPTER, SUBTOPIC?]
    for (const n of chain) {
        if (n.type === 'SUBJECT')  parts.subject  = n.name;
        if (n.type === 'CHAPTER')  parts.chapter  = n.name;
        if (n.type === 'SUBTOPIC') parts.subtopic = n.name;
    }
    return parts;
}

async function main() {
    const allCaches = await prisma.lessonCache.findMany({
        orderBy: { id: 'asc' },
    });

    console.log(`Total lesson_cache rows: ${allCaches.length}`);

    const toRegenerate = allCaches.filter(c => !isJsonl(c.lessonText));
    console.log(`Rows needing regeneration: ${toRegenerate.length}\n`);

    if (DRY_RUN) {
        for (const row of toRegenerate) {
            console.log(`  [${row.id}] contentNodeId=${row.contentNodeId} lang=${row.language}`);
        }
        return;
    }

    let success = 0;
    let failed  = 0;

    for (const row of toRegenerate) {
        const path = await resolveNodePath(row.contentNodeId);
        if (!path) {
            console.warn(`  [${row.id}] Could not resolve node path, skipping.`);
            failed++;
            continue;
        }

        const label = [path.subject, path.chapter, path.subtopic].filter(Boolean).join(' › ');
        console.log(`  Regenerating [${row.id}] ${label} (${row.language})...`);

        try {
            const language = row.language === 'ta' ? 'tamil' : 'english';

            // Stream from the running backend (so it also saves back to cache automatically)
            const response = await axios.post(
                `${BACKEND}/teach`,
                {
                    subject:    path.subject,
                    chapter:    path.chapter,
                    subtopic:   path.subtopic || undefined,
                    userMessage: 'start',
                    history:    [],
                    audience:   '',
                    language,
                },
                { responseType: 'text', timeout: 120000 }
            );

            const fullContent = typeof response.data === 'string' ? response.data : '';

            if (!fullContent.trim()) {
                console.warn(`  [${row.id}] Backend returned empty content, skipping.`);
                failed++;
                continue;
            }

            // If backend already saved it as JSON (cache hit re-served), parse it
            let lessonText = fullContent;
            try {
                const parsed = JSON.parse(fullContent);
                if (parsed.content) lessonText = parsed.content;
            } catch { /* plain JSONL stream — use as-is */ }

            await prisma.lessonCache.update({
                where: { id: row.id },
                data: {
                    lessonText,
                    status:      'generated',
                    generatedAt: new Date(),
                },
            });

            const segCount = lessonText.split('\n').filter(l => { try { return !!JSON.parse(l).text; } catch { return false; } }).length;
            console.log(`  ✔  [${row.id}] Saved (${lessonText.length} chars, ${segCount} JSONL segments)`);
            success++;

            // Brief delay to avoid hammering the AI
            await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
            console.error(`  ✖  [${row.id}] Failed: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n──────────────────────────────────`);
    console.log(`Regenerated: ${success}   Failed: ${failed}`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());

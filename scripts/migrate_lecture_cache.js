/**
 * migrate_lecture_cache.js
 * ========================
 * Reads all rows from the OLD `lecture_cache` table and migrates them into
 * the new `content_nodes` + `lesson_cache` tables.
 *
 * Run AFTER `prisma db push` has created the new tables.
 * Run BEFORE removing LectureCache from schema.
 *
 * Usage:
 *   node scripts/migrate_lecture_cache.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../lms-ai/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 80);
}

/**
 * Find or create a ContentNode.
 * For root nodes (parentId === null) we query by slug + parentId IS NULL via findFirst.
 */
async function getOrCreateNode({ name, slug, type, parentId = null, orderIndex = 0 }) {
    // Prisma findUnique cannot use null in a compound unique — use findFirst instead
    const existing = await prisma.contentNode.findFirst({
        where: {
            slug,
            parentId: parentId ?? null,
        },
    });
    if (existing) return existing;

    return prisma.contentNode.create({
        data: {
            name,
            slug,
            type,
            parentId: parentId ?? null,
            orderIndex,
            isActive: true,
        },
    });
}

async function main() {
    // Pull all rows from the legacy table via raw SQL
    const oldRows = await prisma.$queryRaw`
        SELECT id, subject, chapter, subtopic, audience, content,
               visual_keywords, visual_urls, created_at
        FROM   lecture_cache
        ORDER  BY id
    `;

    console.log(`Found ${oldRows.length} rows in lecture_cache. Migrating…\n`);

    let migratedCount = 0;
    let skippedCount  = 0;

    for (const row of oldRows) {
        const subject  = (row.subject  || 'Unknown Subject').trim();
        const chapter  = (row.chapter  || 'Unknown Chapter').trim();
        const subtopic = (row.subtopic || '').trim();
        const audience = (row.audience || '').trim();

        // Derive language from audience string  (e.g. "|lang:ta" → "ta")
        let language = 'en';
        const langMatch = audience.match(/\|lang:([a-z]+)/);
        if (langMatch) language = langMatch[1];

        const subjectSlug  = slugify(subject);
        const chapterSlug  = slugify(chapter);
        const subtopicSlug = subtopic ? slugify(subtopic) : null;

        try {
            // Layer 1 — SUBJECT (root, no parent)
            const subjectNode = await getOrCreateNode({
                name: subject,
                slug: subjectSlug,
                type: 'SUBJECT',
                parentId: null,
                orderIndex: 0,
            });

            // Layer 2 — CHAPTER
            const chapterNode = await getOrCreateNode({
                name: chapter,
                slug: chapterSlug,
                type: 'CHAPTER',
                parentId: subjectNode.id,
                orderIndex: 0,
            });

            // Layer 3 — SUBTOPIC (only if distinct from chapter)
            let leafNode = chapterNode;
            if (subtopic && subtopic.toLowerCase() !== chapter.toLowerCase() && subtopicSlug) {
                leafNode = await getOrCreateNode({
                    name: subtopic,
                    slug: subtopicSlug,
                    type: 'SUBTOPIC',
                    parentId: chapterNode.id,
                    orderIndex: 0,
                });
            }

            // Upsert into new lesson_cache
            await prisma.lessonCache.upsert({
                where: {
                    contentNodeId_language: {
                        contentNodeId: leafNode.id,
                        language,
                    },
                },
                update: {
                    lessonText:     row.content,
                    visualKeywords: row.visual_keywords ?? undefined,
                    visualUrls:     row.visual_urls     ?? undefined,
                },
                create: {
                    contentNodeId:  leafNode.id,
                    language,
                    lessonText:     row.content,
                    visualKeywords: row.visual_keywords ?? undefined,
                    visualUrls:     row.visual_urls     ?? undefined,
                    generatedAt:    row.created_at,
                },
            });

            const path = [subject, chapter, subtopic].filter(Boolean).join(' › ');
            console.log(`  ✔  [${row.id}] ${path} (lang=${language}, nodeId=${leafNode.id})`);
            migratedCount++;
        } catch (err) {
            console.error(`  ✖  [${row.id}] ${row.subject} › ${row.chapter}: ${err.message}`);
            skippedCount++;
        }
    }

    console.log(`\n──────────────────────────────────────────`);
    console.log(`Migrated: ${migratedCount}   Skipped/Errored: ${skippedCount}`);
    console.log(`\nNext step: remove LectureCache model from schema.prisma, then run:`);
    console.log(`  npx prisma db push --accept-data-loss`);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());

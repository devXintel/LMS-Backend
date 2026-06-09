// Quick script to inspect Tamil lesson cache entries
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Show all LessonCache entries
    const caches = await prisma.lessonCache.findMany({
        select: {
            id: true,
            contentNodeId: true,
            language: true,
            status: true,
            lessonText: false,
            contentNode: {
                select: { id: true, name: true, slug: true, type: true, parentId: true }
            }
        }
    });
    
    console.log('\n=== ALL LESSON CACHE ENTRIES ===');
    for (const c of caches) {
        console.log(`  id=${c.id} | nodeId=${c.contentNodeId} | lang="${c.language}" | status="${c.status}" | node: ${c.contentNode.type} "${c.contentNode.name}" (slug="${c.contentNode.slug}")`);
    }

    // 2. Show all ContentNodes related to Physics / measurements
    const nodes = await prisma.contentNode.findMany({
        select: { id: true, name: true, slug: true, type: true, parentId: true },
        orderBy: { id: 'asc' }
    });

    console.log('\n=== ALL CONTENT NODES ===');
    for (const n of nodes) {
        console.log(`  id=${n.id} | type=${n.type} | slug="${n.slug}" | name="${n.name}" | parentId=${n.parentId}`);
    }

    // 3. Check specifically for Tamil caches
    const tamilCaches = await prisma.lessonCache.findMany({
        where: { language: 'ta' },
        select: {
            id: true,
            contentNodeId: true,
            language: true,
            lessonText: true,
            contentNode: { select: { name: true, slug: true, type: true } }
        }
    });

    console.log('\n=== TAMIL (ta) CACHES ===');
    for (const c of tamilCaches) {
        const preview = c.lessonText?.substring(0, 150) || '(empty)';
        console.log(`  id=${c.id} | nodeId=${c.contentNodeId} | node: ${c.contentNode.type} "${c.contentNode.name}"`);
        console.log(`    text preview: ${preview}...`);
        
        // Check if enriched
        try {
            const firstLine = c.lessonText.split('\n')[0].trim();
            const parsed = JSON.parse(firstLine);
            console.log(`    enriched: ${parsed.audioUrl !== undefined ? 'YES' : 'NO'}`);
        } catch(e) {
            console.log(`    enriched: PARSE ERROR`);
        }
    }

    // 4. Simulate resolveContentNode for the URL params from the screenshot
    const subject = 'Physics';
    const chapter = 'PHYSICS AND MEASUREMENT';
    const subtopic = 'Units of measurements';

    function slugify(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 80);
    }

    const subjectSlug = slugify(subject);
    const chapterSlug = slugify(chapter);
    const subtopicSlug = slugify(subtopic);

    console.log('\n=== RESOLVE NODE SIMULATION ===');
    console.log(`  subject="${subject}" -> slug="${subjectSlug}"`);
    console.log(`  chapter="${chapter}" -> slug="${chapterSlug}"`);
    console.log(`  subtopic="${subtopic}" -> slug="${subtopicSlug}"`);

    const subjectNode = await prisma.contentNode.findFirst({
        where: { slug: subjectSlug, parentId: null }
    });
    console.log(`  Subject node: ${subjectNode ? `id=${subjectNode.id}` : 'NOT FOUND'}`);

    if (subjectNode) {
        const chapterNode = await prisma.contentNode.findFirst({
            where: { slug: chapterSlug, parentId: subjectNode.id }
        });
        console.log(`  Chapter node: ${chapterNode ? `id=${chapterNode.id}` : 'NOT FOUND'}`);

        if (chapterNode) {
            const subtopicNode = await prisma.contentNode.findFirst({
                where: { slug: subtopicSlug, parentId: chapterNode.id }
            });
            console.log(`  Subtopic node: ${subtopicNode ? `id=${subtopicNode.id}` : 'NOT FOUND'}`);

            const finalNodeId = subtopicNode?.id || chapterNode.id;
            console.log(`  Final nodeId for cache lookup: ${finalNodeId}`);

            const cached = await prisma.lessonCache.findUnique({
                where: { contentNodeId_language: { contentNodeId: finalNodeId, language: 'ta' } }
            });
            console.log(`  Tamil cache for nodeId=${finalNodeId}: ${cached ? `FOUND (id=${cached.id}, ${cached.lessonText.length} chars)` : 'NOT FOUND'}`);
        }
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

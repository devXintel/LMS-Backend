/**
 * pregenerate_all.js
 * ───────────────────
 * Finds all SUBTOPIC nodes in the database and triggers dual-language
 * generation (English and Tamil) for each.
 */

require('ts-node/register');
require('dotenv').config({ path: require('path').join(__dirname, '../../lms-ai/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { teach, preGenerate } = require('../src/controllers/teach.controller');

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
    console.log("Starting full pre-generation for all subtopics...");

    const subtopics = await prisma.contentNode.findMany({
        where: { type: 'SUBTOPIC' },
        orderBy: { id: 'asc' }
    });

    console.log(`Found ${subtopics.length} subtopics.`);

    // Group subtopics by Chapter to call preGenerate in chunks (as it's designed)
    const chapterGroups = {};

    for (const sub of subtopics) {
        const path = await resolveNodePath(sub.id);
        if (!path || !path.subject || !path.chapter) continue;

        const key = `${path.subject}|${path.chapter}`;
        if (!chapterGroups[key]) {
            chapterGroups[key] = {
                subject: path.subject,
                chapter: path.chapter,
                subtopics: []
            };
        }
        chapterGroups[key].subtopics.push(path.subtopic);
    }

    const groups = Object.values(chapterGroups);
    console.log(`Grouped into ${groups.length} chapters.`);

    for (const group of groups) {
        console.log(`\n--- Processing Chapter: ${group.chapter} (${group.subject}) ---`);
        
        // Mock req/res for preGenerate controller
        const req = {
            body: {
                subject: group.subject,
                chapter: group.chapter,
                subtopics: group.subtopics,
                audience: "NEET/competitive exam aspirants"
            }
        };

        const res = {
            status: (code) => ({ json: (data) => console.log(`[Response ${code}]`, data) }),
            json: (data) => console.log(`[Response 200]`, data)
        };

        try {
            await preGenerate(req, res);
            console.log(`Finished chapter: ${group.chapter}`);
        } catch (err) {
            console.error(`Failed chapter ${group.chapter}:`, err.message);
        }
    }

    console.log("\nFull pre-generation sequence complete.");
}

main()
    .catch(err => console.error("Fatal Error:", err))
    .finally(() => prisma.$disconnect());

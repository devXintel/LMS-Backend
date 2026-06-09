require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const en = await p.lessonCache.findUnique({
        where: { contentNodeId_language: { contentNodeId: 3, language: 'en' } }
    });
    console.log(en ? `EN cache: id=${en.id}, ${en.lessonText.length} chars` : 'EN cache: NOT FOUND');

    const ta = await p.lessonCache.findUnique({
        where: { contentNodeId_language: { contentNodeId: 3, language: 'ta' } }
    });
    console.log(ta ? `TA cache: id=${ta.id}, ${ta.lessonText.length} chars` : 'TA cache: NOT FOUND');

    await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

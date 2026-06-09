/**
 * clear_stale_caches.js
 * Deletes all LessonCache rows that are NOT valid JSONL.
 * The backend will re-generate them fresh (as JSONL) on next page load.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../lms-ai/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isJsonl(text) {
    const lines = (text || '').split('\n').filter(l => l.trim());
    let count = 0;
    for (const line of lines) {
        try {
            const o = JSON.parse(line);
            if (o.text) count++;
            if (count >= 3) return true;
        } catch { /* not JSON */ }
    }
    return false;
}

async function main() {
    const all = await prisma.lessonCache.findMany();
    const stale = all.filter(r => !isJsonl(r.lessonText));
    
    console.log(`Total rows: ${all.length}`);
    console.log(`Stale (non-JSONL) rows: ${stale.length}`);
    
    if (stale.length === 0) {
        console.log('Nothing to delete.');
        return;
    }
    
    const ids = stale.map(r => r.id);
    await prisma.lessonCache.deleteMany({ where: { id: { in: ids } } });
    
    console.log(`Deleted IDs: ${ids.join(', ')}`);
    console.log('\nThe backend will auto-regenerate these as JSONL on next lesson load.');
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());

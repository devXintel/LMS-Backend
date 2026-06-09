const prisma = require('../src/config/prisma');
const fs = require('fs');
const path = require('path');

async function main() {
    // Delete all Tamil lesson caches so they get freshly regenerated with full enrichment
    const result = await prisma.lessonCache.deleteMany({ where: { language: 'ta' } });
    console.log('Deleted stale Tamil DB caches:', result.count);

    // Also delete old Tamil MP3 files so they get freshly regenerated with correct voice
    const indicDir = path.join(__dirname, 'public/audio/indic');
    if (fs.existsSync(indicDir)) {
        const files = fs.readdirSync(indicDir);
        let deleted = 0;
        for (const file of files) {
            if (file.startsWith('ta_') || file.startsWith('ta-')) {
                fs.unlinkSync(path.join(indicDir, file));
                deleted++;
            }
        }
        console.log('Deleted stale Tamil audio files:', deleted);
    } else {
        console.log('No indic audio directory found — skipping file cleanup.');
    }

    await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

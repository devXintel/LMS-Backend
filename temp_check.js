const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const caches = await prisma.lessonCache.findMany({
            where: { language: 'ta' },
            include: { contentNode: true }
        });
        
        console.log(`Checking audioUrl in ${caches.length} Tamil caches:`);
        for (const cache of caches) {
            const lines = cache.lessonText.split('\n').filter(Boolean);
            if (lines.length > 0) {
                let audioUrl = "NOT FOUND";
                try {
                    const parsed = JSON.parse(lines[0]);
                    audioUrl = parsed.audioUrl || "NULL/UNDEFINED";
                } catch (e) {
                    const match = lines[0].match(/"audioUrl"\s*:\s*"([^"]+)"/);
                    if (match) audioUrl = match[1];
                }
                console.log(`Node ${cache.contentNodeId} ("${cache.contentNode.name}") segment 0 audioUrl: "${audioUrl}"`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();

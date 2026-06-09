const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const caches = await prisma.lessonCache.findMany({
            where: { language: 'ta' },
            include: { contentNode: true }
        });
        
        console.log(`Analyzing ${caches.length} Tamil caches:`);
        for (const cache of caches) {
            console.log(`\n==================================================`);
            console.log(`Node ${cache.contentNodeId}: "${cache.contentNode.name}"`);
            const lines = cache.lessonText.split('\n').filter(Boolean);
            console.log(`Total lines in lessonText: ${lines.length}`);
            
            lines.forEach((line, idx) => {
                try {
                    const parsed = JSON.parse(line);
                    console.log(`Segment ${idx}: [Parsed] text: "${parsed.text}"`);
                } catch (e) {
                    console.log(`Segment ${idx}: [Unparsed] raw: "${line}"`);
                }
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();

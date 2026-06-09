const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const caches = await prisma.lessonCache.findMany({
            where: { language: 'ta' },
            include: { contentNode: true }
        });
        
        console.log(`Analyzing ${caches.length} newly generated Tamil caches:`);
        for (const cache of caches) {
            console.log(`\n==================================================`);
            console.log(`Node ${cache.contentNodeId}: "${cache.contentNode.name}"`);
            const lines = cache.lessonText.split('\n').filter(Boolean);
            console.log(`Total segments: ${lines.length}`);
            
            lines.forEach((line, idx) => {
                let text = "";
                try {
                    const parsed = JSON.parse(line);
                    text = parsed.text || "";
                } catch (e) {
                    const match = line.match(/"text"\s*:\s*"([^"]+)"/);
                    if (match) text = match[1];
                }
                
                // Print the language/text of each segment
                const isEnglish = /\b(the|is|are|and|in|of|to|with|for|that|it|we|you)\b/i.test(text);
                console.log(`  Segment ${idx} (${isEnglish ? 'ENGLISH' : 'TAMIL'}): "${text.substring(0, 100)}"`);
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCache() {
    console.log('--- Checking Prisma LessonCache DB for Error Cache ---');
    try {
        const caches = await prisma.lessonCache.findMany({
            where: {
                lessonText: {
                    contains: 'API issues'
                }
            }
        });
        console.log(`Found ${caches.length} error caches in LessonCache.`);
        for (const c of caches) {
            console.log(`Cache ID: ${c.id}`);
            console.log(`Language: ${c.language}`);
            console.log(`Text length: ${c.lessonText.length}`);
            console.log(`Text preview: ${c.lessonText.slice(0, 300)}`);
        }
    } catch (err) {
        console.error('Prisma query failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

checkCache();

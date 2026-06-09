const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteErrorCaches() {
    console.log('--- Cleaning Up Corrupted Error Records from LessonCache DB ---');
    try {
        const deleteCount = await prisma.lessonCache.deleteMany({
            where: {
                lessonText: {
                    contains: 'API issues'
                }
            }
        });
        console.log(`Successfully deleted ${deleteCount.count} corrupted error records from LessonCache.`);
    } catch (err) {
        console.error('Delete failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

deleteErrorCaches();

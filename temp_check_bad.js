const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const caches = await prisma.lessonCache.findMany();
        console.log('Total caches in DB:', caches.length);
        let found = false;
        caches.forEach(x => {
            if (x.lessonText.includes('apologize')) {
                found = true;
                console.log('Found bad cache for node:', x.contentNodeId, 'lang:', x.language);
            }
        });
        if (!found) {
            console.log('No bad caches found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();

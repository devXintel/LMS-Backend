const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.lessonCache.count();
    console.log('Current cache count:', count);
}

main().finally(() => prisma.$disconnect());

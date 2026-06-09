const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTamil() {
  const tamilLessons = await prisma.lessonCache.findMany({
    where: { language: 'ta' },
    take: 1
  });
  console.log(JSON.stringify(tamilLessons, null, 2));
  process.exit(0);
}

checkTamil();

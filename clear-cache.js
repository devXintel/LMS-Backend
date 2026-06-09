const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.lessonCache.updateMany({
    where: { status: 'generated' },
    data: {
      visualUrls: null,
      visualKeywords: null
    }
  });
  console.log('Cleared visualUrls and visualKeywords from all LessonCache entries.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

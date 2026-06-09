const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.lessonCache.deleteMany();
  console.log('Successfully cleared lesson cache:', res);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

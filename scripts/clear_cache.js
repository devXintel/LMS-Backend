require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCache() {
  await prisma.lessonCache.deleteMany({});
  console.log('Cleared all lesson caches.');
  await prisma.$disconnect();
}

clearCache();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  const result = await prisma.lectureCache.deleteMany({
    where: {
      content: {
        contains: 'I apologize, but'
      }
    }
  });
  console.log('Deleted ' + result.count + ' bad cache records.');
  await prisma.$disconnect();
}

clean().catch(e => {
  console.error(e);
  prisma.$disconnect();
});

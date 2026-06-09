const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Checking User & AcademicProfile entries...");
  const profiles = await prisma.userAcademicProfile.findMany({
    include: { user: true }
  });
  
  profiles.forEach((p, i) => {
    console.log(`\n[${i+1}] User: ${p.user?.name} (ID: ${p.userId})`);
    console.log(`    Email: ${p.user?.email}`);
    console.log(`    Role: ${p.user?.role}`);
    console.log(`    Category: ${p.category}`);
    console.log(`    Exam: ${p.exam}`);
    console.log(`    Board: ${p.board}`);
  });
}

run().catch(console.error).finally(() => prisma.$disconnect());

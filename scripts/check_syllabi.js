const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Checking ExamSyllabus entries...");
  const syllabi = await prisma.examSyllabus.findMany({
    include: { exam: true }
  });
  console.log("Total syllabi found:", syllabi.length);
  
  syllabi.forEach((s, i) => {
    console.log(`\n[${i+1}] ID: ${s.id}`);
    console.log(`    Exam: ${s.exam?.name}`);
    console.log(`    File: ${s.fileName}`);
    console.log(`    Path: ${s.filePath}`);
    console.log(`    Chapters extracted:`, !!s.chapters);
    if (s.chapters) {
       console.log(`    Chapters preview:`, JSON.stringify(s.chapters).substring(0, 200));
    }
  });
}

run().catch(console.error).finally(() => prisma.$disconnect());

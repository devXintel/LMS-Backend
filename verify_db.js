const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
    await prisma.$connect();
    const rows = await prisma.examSyllabus.findMany({ select: { id: true, chapters: true } });
    rows.forEach(r => {
        const ch = r.chapters;
        if (Array.isArray(ch) && ch.length > 0 && ch[0].subject) {
            let log = `ID ${r.id}: ${ch.length} subjects\n`;
            ch.forEach(s => {
                log += `  ${s.subject}: ${s.chapters.length} chapters\n`;
                s.chapters.forEach((c, i) => {
                    log += `    ${i+1}. ${c.name} → ${(c.subtopics||[]).length} subtopics\n`;
                    (c.subtopics||[]).slice(0, 3).forEach(st => log += `       - ${st}\n`);
                });
            });
            fs.writeFileSync('db_verification.txt', log);
            process.stdout.write(log.substring(0, 2000) + '\n');
        } else {
            process.stdout.write(`ID ${r.id}: chapters=${JSON.stringify(ch).substring(0,200)}\n`);
        }
    });
    await prisma.$disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });

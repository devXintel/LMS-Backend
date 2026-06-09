const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { extractChaptersFromPdfUrl } = require('./src/services/ai-syllabus.service');

const prisma = new PrismaClient();

// The actual URL and ID from the database
const SYLLABUS_ID = 8;
const PDF_URL = 'https://ai-lms-storage.s3.us-east-1.amazonaws.com/syllabus/exams/1/1772096212731-neet2.pdf';

async function run() {
    try {
        console.log('Extracting from:', PDF_URL);
        const chapters = await extractChaptersFromPdfUrl(PDF_URL);

        if (!chapters || chapters.length === 0) {
            console.error('Extraction returned null or empty array');
            return;
        }

        // Print summary
        let totalChapters = 0;
        let totalSubtopics = 0;
        chapters.forEach(s => {
            const st = s.chapters.reduce((a, c) => a + c.subtopics.length, 0);
            totalChapters += s.chapters.length;
            totalSubtopics += st;
            console.log(`  ${s.subject}: ${s.chapters.length} chapters, ${st} subtopics`);
            // Print first chapter detail
            if (s.chapters[0]) {
                console.log(`    First chapter: "${s.chapters[0].name}" (${s.chapters[0].subtopics.length} subtopics)`);
                s.chapters[0].subtopics.slice(0, 5).forEach(st => console.log(`      - ${st}`));
            }
        });
        console.log(`\nTOTAL: ${chapters.length} subjects, ${totalChapters} chapters, ${totalSubtopics} subtopics`);

        // Update DB
        await prisma.$connect();
        await prisma.examSyllabus.update({
            where: { id: SYLLABUS_ID },
            data: { chapters }
        });
        console.log(`\n✅ Database updated for syllabus ID ${SYLLABUS_ID}`);

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    } finally {
        await prisma.$disconnect();
    }
}

run();

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { extractChaptersFromPdfUrl } = require('./src/services/ai-syllabus.service');

const prisma = new PrismaClient();

// Correct S3 URL (confirmed from bucket listing)
const CORRECT_URL = 'https://ai-lms-storage.s3.us-east-1.amazonaws.com/syllabus/exams/1/Neet.pdf';
const SYLLABUS_ID = 8;

async function run() {
    try {
        console.log('Step 1: Fixing filePath in DB to correct S3 URL...');
        await prisma.$connect();
        
        await prisma.examSyllabus.update({
            where: { id: SYLLABUS_ID },
            data: { filePath: CORRECT_URL }
        });
        console.log('  ✓ filePath updated to:', CORRECT_URL);

        console.log('\nStep 2: Extracting chapters from PDF...');
        const chapters = await extractChaptersFromPdfUrl(CORRECT_URL);

        if (!chapters || chapters.length === 0) {
            console.error('  FAILED: extraction returned null/empty');
            return;
        }

        // Print summary
        let totalChapters = 0;
        let totalSubtopics = 0;
        chapters.forEach(s => {
            const st = s.chapters.reduce((a, c) => a + c.subtopics.length, 0);
            totalChapters += s.chapters.length;
            totalSubtopics += st;
            console.log(`  ✓ ${s.subject}: ${s.chapters.length} chapters, ${st} subtopics`);
        });
        console.log(`\nTOTAL: ${chapters.length} subjects, ${totalChapters} chapters, ${totalSubtopics} subtopics`);

        console.log('\nStep 3: Saving to database...');
        await prisma.examSyllabus.update({
            where: { id: SYLLABUS_ID },
            data: { chapters }
        });
        console.log('  ✓ Database updated for syllabus ID', SYLLABUS_ID);
        console.log('\n✅ Done! Refresh your app to see all subjects, chapters, and subtopics.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();

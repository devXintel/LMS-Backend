/**
 * Re-extract NEET syllabus from S3 and update the database.
 * Run: node reseed_syllabus.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });
require('dotenv').config(); // also load backend .env for DATABASE_URL

const { PrismaClient } = require('@prisma/client');
const { extractChaptersFromPdfUrl } = require('./src/services/ai-syllabus.service');

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Connecting to database...');
        await prisma.$connect();

        // Find all NEET syllabi
        const syllabi = await prisma.examSyllabus.findMany({
            include: { exam: true }
        });

        if (syllabi.length === 0) {
            console.log('No syllabi found in DB.');
            return;
        }

        console.log(`Found ${syllabi.length} syllabus record(s).\n`);

        for (const syl of syllabi) {
            const url = syl.filePath;
            if (!url || !url.startsWith('http')) {
                console.log(`Skipping ID ${syl.id} — no valid S3 URL (filePath: ${url})`);
                continue;
            }

            console.log(`\nExtracting from: ${url}`);
            const chapters = await extractChaptersFromPdfUrl(url);

            if (!chapters || chapters.length === 0) {
                console.error(`  FAILED to extract chapters for syllabus ID ${syl.id}`);
                continue;
            }

            // Print summary
            chapters.forEach(s => {
                const totalSubtopics = s.chapters.reduce((acc, ch) => acc + ch.subtopics.length, 0);
                console.log(`  ✓ ${s.subject}: ${s.chapters.length} chapters, ${totalSubtopics} total subtopics`);
            });

            // Update DB
            await prisma.examSyllabus.update({
                where: { id: syl.id },
                data: { chapters }
            });

            console.log(`  ✓ Updated DB record ID ${syl.id}`);
        }

        console.log('\n✅ All syllabus records updated successfully!');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { extractChaptersFromPdfUrl } = require('./src/services/ai-syllabus.service');

async function main() {
    console.log('Starting backfill for missing ExamSyllabus chapters...');
    let allSyllabi;
    for (let i = 0; i < 5; i++) {
        try {
            allSyllabi = await prisma.examSyllabus.findMany();
            break;
        } catch (err) {
            console.log("DB connection failed, retrying...", err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!allSyllabi) {
        console.error("Could not connect to DB after 5 retries");
        return;
    }

    const missing = allSyllabi.filter(s => !s.chapters);
    console.log(`Found ${missing.length} syllabi missing chapters.`);

    for (const syllabus of missing) {
        if (!syllabus.filePath) continue;
        console.log(`Processing syllabus ID: ${syllabus.id} (${syllabus.fileName})`);

        try {
            const chapters = await extractChaptersFromPdfUrl(syllabus.filePath);
            if (chapters && chapters.length > 0) {
                // Retry for update
                for (let i = 0; i < 3; i++) {
                    try {
                        await prisma.examSyllabus.update({
                            where: { id: syllabus.id },
                            data: { chapters }
                        });
                        console.log(`Successfully updated syllabus ID ${syllabus.id} with chapters.`);
                        break;
                    } catch (err) {
                        console.log("Update failed, retrying...", err.message);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            } else {
                console.log(`No chapters extracted for syllabus ID ${syllabus.id}`);
            }
        } catch (error) {
            console.error(`Error processing syllabus ID ${syllabus.id}:`, error.message);
        }
    }

    console.log('Backfill completed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

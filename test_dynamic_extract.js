const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });
const { extractChaptersFromPdfUrl } = require('./src/services/ai-syllabus.service');
const fs = require('fs');

const PDF_URL = 'https://ai-lms-storage.s3.us-east-1.amazonaws.com/syllabus/exams/1/Neet.pdf';

async function run() {
    console.log('Testing dynamic extraction from:', PDF_URL);
    const result = await extractChaptersFromPdfUrl(PDF_URL);

    if (!result) {
        console.error('FAILED: result is null');
        return;
    }

    console.log('\n=== EXTRACTION RESULT ===');
    result.forEach(s => {
        console.log(`\nSUBJECT: ${s.subject} (${s.chapters.length} chapters)`);
        s.chapters.forEach((ch, i) => {
            console.log(`  ${i+1}. ${ch.name} → ${ch.subtopics.length} subtopics`);
            ch.subtopics.slice(0, 5).forEach(st => console.log(`       - ${st}`));
            if (ch.subtopics.length > 5) console.log(`       ... and ${ch.subtopics.length - 5} more`);
        });
    });

    fs.writeFileSync('neet_parsed.json', JSON.stringify(result, null, 2));
    console.log('\nFull result saved to neet_parsed.json');
}

run().catch(console.error);

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const PDFParser = require("pdf2json");
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://neondb_owner:npg_pq7frsvDU9ja@ep-dark-meadow-ahx9aeqj-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
        }
    }
});

function extractTextFromPdf(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(this, 1);
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
            resolve(pdfParser.getRawTextContent());
        });
        pdfParser.loadPDF(pdfPath);
    });
}

function parseSyllabus(text) {
    const subjects = ['PHYSICS', 'CHEMISTRY', 'BIOLOGY'];
    const JSONResult = [];

    for (let i = 0; i < subjects.length; i++) {
        const currentSubject = subjects[i];
        const nextSubject = subjects[i + 1] || null;

        const startIndex = text.indexOf(currentSubject);
        const endIndex = nextSubject ? text.indexOf(nextSubject, startIndex) : text.length;

        if (startIndex !== -1) {
            const block = text.substring(startIndex, endIndex);
            const unitRegex = /UNIT\s*[\dIVX]+\s*[:\-]\s*([^\r\n]+)/gi;
            let match;
            const chapters = [];
            while ((match = unitRegex.exec(block)) !== null) {
                chapters.push(match[1].trim());
            }
            JSONResult.push({
                subject: currentSubject.charAt(0).toUpperCase() + currentSubject.slice(1).toLowerCase(),
                chapters: chapters
            });
        }
    }
    return JSONResult;
}

async function main() {
    console.log('Connecting to DB...');
    let connected = false;
    for (let i = 0; i < 5; i++) {
        try {
            await prisma.$connect();
            connected = true;
            break;
        } catch (err) {
            console.log('DB connection failed, retrying...', err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!connected) {
        console.error('Failed to connect to database.');
        return;
    }

    const exam = await prisma.exam.findFirst({
        where: { name: { contains: 'neet', mode: 'insensitive' } }
    });

    if (!exam) {
        console.log('No exam found matching NEET');
        return;
    }

    const neetSyllabi = await prisma.examSyllabus.findMany({
        where: { examId: exam.id }
    });

    if (neetSyllabi.length === 0) {
        console.log('No exam_syllabus entries found for NEET');
        return;
    }

    for (const syllabus of neetSyllabi) {
        if (!syllabus.filePath) continue;

        let localPath = path.join(__dirname, 'public', 'uploads', path.basename(syllabus.filePath));

        if (!fs.existsSync(localPath)) {
            console.log(`File not found: ${localPath}`);
            console.log("Using a fallback PDF file that is known to exist.");
            localPath = path.join(__dirname, 'public', 'uploads', '1769178320600-103616716-Neet.pdf');
        }

        console.log(`Extracting text from PDF: ${localPath}`);
        const text = await extractTextFromPdf(localPath);
        const chaptersJson = parseSyllabus(text);

        if (chaptersJson && chaptersJson.length > 0 && chaptersJson[0].chapters.length > 0) {
            console.log(`Successfully parsed ${chaptersJson.length} subjects. Updating DB...`);
            await prisma.examSyllabus.update({
                where: { id: syllabus.id },
                data: { chapters: chaptersJson }
            });
            console.log(`Updated syllabus ID: ${syllabus.id}`);
        } else {
            console.log(`Failed to parse chapters for syllabus ID: ${syllabus.id}.`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.examSyllabus.findMany({
    select: { id: true, filePath: true, fileName: true, chapters: true }
}).then(rows => {
    rows.forEach(s => {
        const ch = s.chapters;
        let info = 'null';
        if (Array.isArray(ch) && ch.length > 0) {
            const first = ch[0];
            if (first && first.subject) {
                const subtopicCount = first.chapters && first.chapters[0] ? (first.chapters[0].subtopics || []).length : 0;
                info = `${ch.length} subjects, first subject first chapter subtopics: ${subtopicCount}`;
            } else {
                info = `flat array, ${ch.length} items`;
            }
        }
        console.log(`ID: ${s.id} | file: ${s.fileName} | url: ${(s.filePath||'').substring(0,90)} | chapters: ${info}`);
    });
}).catch(e => console.error(e.message)).finally(() => p.$disconnect());

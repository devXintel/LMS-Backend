require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.examSyllabus.findMany({
    select: { id: true, filePath: true, fileName: true }
}).then(rows => {
    rows.forEach(s => {
        process.stdout.write('ID=' + s.id + ' FILE=' + s.fileName + ' URL=' + s.filePath + '\n');
    });
}).catch(e => process.stderr.write(e.message + '\n')).finally(() => p.$disconnect());

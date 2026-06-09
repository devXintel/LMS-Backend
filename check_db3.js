require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

p.examSyllabus.findMany({
    select: { id: true, filePath: true, fileName: true }
}).then(rows => {
    fs.writeFileSync('db_urls.txt', JSON.stringify(rows, null, 2));
    console.log('Written to db_urls.txt');
}).catch(e => console.error(e.message)).finally(() => p.$disconnect());

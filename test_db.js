const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
    try {
        const result = await prisma.examSyllabus.findMany({
            orderBy: { createdAt: 'desc' },
            take: 2
        });
        fs.writeFileSync('db_out.json', JSON.stringify(result, null, 2));
        console.log("Success");
    } catch(err) {
        fs.writeFileSync('db_out.json', JSON.stringify({error: err.message}, null, 2));
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
run();

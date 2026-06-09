require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const subjects = await prisma.subjectSyllabus.findMany({
            take: 10
        });
        console.log('Sample Subject Syllabi:');
        console.table(subjects);

        const categories = await prisma.category.findMany();
        console.log('\nAvailable Categories:');
        console.table(categories);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
        console.log('Tables in database:');
        console.table(tables);

        const enrollmentExists = tables.some(t => t.table_name === 'enrollment');
        if (enrollmentExists) {
            console.log('\nEnrollment table found! Columns:');
            const columns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'enrollment'
      `;
            console.table(columns);
        } else {
            console.log('\nEnrollment table NOT found in public schema.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();

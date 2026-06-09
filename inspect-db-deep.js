require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Deep Schema Inspection ---');

        // Check all tables in all schemas except system schemas
        const tables = await prisma.$queryRaw`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    `;
        console.log('\nAll tables across schemas:');
        console.table(tables);

        // Search for any table or column containing "enroll"
        const enrollSearch = await prisma.$queryRaw`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name ILIKE '%enroll%' OR column_name ILIKE '%enroll%'
    `;
        console.log('\nSearch for "enroll" in names:');
        console.table(enrollSearch);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();

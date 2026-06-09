require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Database Inspection ---');

        // List all tables
        const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
        console.log('\nTables found:');
        console.table(tables.map(t => t.table_name));

        // Check specifically for enrollment
        const enrollmentTable = tables.find(t => t.table_name.toLowerCase() === 'enrollment');
        if (enrollmentTable) {
            console.log(`\nTable "${enrollmentTable.table_name}" found!`);
            const columns = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${enrollmentTable.table_name}'
      `);
            console.log('Columns:');
            console.table(columns);

            const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${enrollmentTable.table_name}"`);
            console.log('Row count:', count);
        } else {
            console.log('\n"enrollment" table NOT found.');
        }

        // Check Academic Profile as fallback
        const profiles = await prisma.userAcademicProfile.findMany({ take: 1 });
        console.log('\nAcademic Profile Sample:', profiles);

    } catch (err) {
        console.error('Connection Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();

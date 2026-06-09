require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const counts = await prisma.$queryRaw`
            SELECT user_id, COUNT(*) as count 
            FROM user_academic_profile 
            GROUP BY user_id 
            HAVING COUNT(*) > 1
        `;
        console.log('Users with multiple academic profiles:');
        console.table(counts);

        const allEntries = await prisma.$queryRaw`
            SELECT * FROM user_academic_profile LIMIT 10
        `;
        console.log('\nSample entries in user_academic_profile:');
        console.table(allEntries);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();

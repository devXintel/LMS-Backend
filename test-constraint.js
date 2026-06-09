require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Find an existing user ID
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log('No users found to test with.');
            return;
        }

        console.log(`Testing multi-enrollment for User ID: ${user.id}`);

        // Try to insert a second profile manually via queryRaw to bypass Prisma's unique check if it's only at client level
        // Actually Prisma's unique check is usually at DB level.

        await prisma.$executeRaw`
            INSERT INTO user_academic_profile (user_id, category, board)
            VALUES (${user.id}, 'Test Category', 'Test Board')
        `;
        console.log('Successfully inserted a second profile! The DB allows it.');

    } catch (err) {
        console.error('Failed to insert second profile:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();

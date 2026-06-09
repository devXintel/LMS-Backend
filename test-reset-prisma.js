const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReset() {
    const userId = 1; // Assuming user ID 1 exists

    console.log(`Testing reset for user ${userId} using Prisma directly...`);

    try {
        const profile = await prisma.userAcademicProfile.update({
            where: { userId: parseInt(userId) },
            data: {
                category: null,
                board: null,
                state: null,
                medium: null,
                exam: null,
                stream: null,
                schoolName: null,
                termId: null,
                mediumId: null
            }
        });

        console.log('Success: Academic profile reset successfully');
        console.log('Updated Profile:', profile);

        // Verify fields are null
        const { category, board, state, medium, exam, stream, schoolName } = profile;
        if (category === null && board === null && state === null && medium === null && exam === null && stream === null && schoolName === null) {
            console.log('Verification: All fields successfully reset to null.');
        } else {
            console.error('Verification FAILED: Some fields are not null.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testReset();

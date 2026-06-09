const prisma = require('../src/config/prisma');

async function checkCategories() {
    try {
        const categories = await prisma.category.findMany();
        console.log("Categories:", categories.map(c => c.name));

        const distinctProfileCategories = await prisma.userAcademicProfile.findMany({
            distinct: ['category'],
            select: {
                category: true
            }
        });
        console.log("Used Categories in Profiles:", distinctProfileCategories.map(p => p.category));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkCategories();

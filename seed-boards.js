const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const data = require('./db-names.json');

async function main() {
    console.log('Seeding boards...');
    for (const boardName of data.boards) {
        await prisma.board.upsert({
            where: { name: boardName },
            update: {},
            create: { name: boardName },
        });
        console.log(`- Ensured board: ${boardName}`);
    }
    console.log('Boards seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

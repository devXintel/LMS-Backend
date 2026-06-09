const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const syllabi = await prisma.subjectSyllabus.findMany();
    console.log(JSON.stringify(syllabi, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

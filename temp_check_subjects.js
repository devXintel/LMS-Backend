const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const data = await prisma.subjectSyllabus.findMany({ where: { category: "Aspirant" } });
    console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

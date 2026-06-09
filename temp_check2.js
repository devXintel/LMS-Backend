const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const data = await prisma.user.findFirst({
        where: { role: 'aspirant' },
        include: { academicProfile: true }
    });
    console.log(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

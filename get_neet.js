const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://neondb_owner:npg_pq7frsvDU9ja@ep-dark-meadow-ahx9aeqj-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
        }
    }
});

async function main() {
    const exam = await prisma.exam.findFirst({
        where: { name: { contains: 'neet', mode: 'insensitive' } }
    });
    if (!exam) {
        console.log('No neet exam found.');
        return;
    }
    const syllabi = await prisma.examSyllabus.findMany({
        where: { examId: exam.id },
        include: { exam: true }
    });
    console.log(JSON.stringify(syllabi, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

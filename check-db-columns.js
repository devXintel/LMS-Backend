const prisma = require('./src/config/prisma');

async function checkDb() {
    try {
        const subjectCount = await prisma.subjectSyllabus.count();
        const examCount = await prisma.examSyllabus.count();

        console.log(`SubjectSyllabus Count: ${subjectCount}`);
        console.log(`ExamSyllabus Count: ${examCount}`);

        if (subjectCount > 0) {
            console.log('\n--- SubjectSyllabus Sample ---');
            const subjects = await prisma.subjectSyllabus.findMany({ take: 10 });
            subjects.forEach(s => {
                console.log(`ID: ${s.id}, Name: ${s.subjectName}, Embedded: ${s.embedded}, Original: ${s.originalFile}`);
            });
        }

        if (examCount > 0) {
            console.log('\n--- ExamSyllabus Sample ---');
            const exams = await prisma.examSyllabus.findMany({ take: 10 });
            exams.forEach(e => {
                console.log(`ID: ${e.id}, Embedded: ${e.embedded}, Original: ${e.originalFile}`);
            });
        }
    } catch (err) {
        console.error('DB Error:', err);
    }
}

checkDb()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

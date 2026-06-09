const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding test data...');

    // Use specific student ID 57
    const studentId = 57;

    const student = await prisma.user.findUnique({
        where: { id: studentId }
    });

    if (!student) {
        console.error(`❌ Student with ID ${studentId} not found.`);
        return;
    }

    console.log(`✅ Found student: ${student.name} (ID: ${student.id})`);

    // Seed Test 1: Multiple Choice Test
    const test1 = await prisma.test.create({
        data: {
            title: 'Photosynthesis - Multiple Choice Quiz',
            description: 'AI-generated test on photosynthesis basics',
            aiModel: 'gemini-1.5-flash',
            topic: 'Photosynthesis',
            difficulty: 'EASY',
            category: 'Aspirant',
            assignedTo: student.id,
            type: 'MULTIPLE_CHOICE',
            questionsUrl: 's3://lms-bucket/tests/seed-1/questions.json',
            totalMarks: 20,
            passingMarks: 10,
            duration: 30,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });

    console.log(`✅ Created Test 1: ${test1.title} (ID: ${test1.id})`);

    // Seed Test 2: Handwritten Test
    const test2 = await prisma.test.create({
        data: {
            title: 'Cell Biology - Essay Questions',
            description: 'AI-generated handwritten test on cell structure',
            aiModel: 'gemini-1.5-flash',
            topic: 'Cell Biology',
            difficulty: 'MEDIUM',
            category: 'Aspirant',
            assignedTo: student.id,
            type: 'HANDWRITTEN',
            questionsUrl: 's3://lms-bucket/tests/seed-2/questions.json',
            totalMarks: 30,
            passingMarks: 15,
            duration: 45,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });

    console.log(`✅ Created Test 2: ${test2.title} (ID: ${test2.id})`);

    // Seed Test 3: Mixed Test
    const test3 = await prisma.test.create({
        data: {
            title: 'General Science - Mixed Format',
            description: 'AI-generated test with MCQ and essay questions',
            aiModel: 'gemini-1.5-flash',
            topic: 'General Science',
            difficulty: 'HARD',
            category: 'Aspirant',
            assignedTo: student.id,
            type: 'MIXED',
            questionsUrl: 's3://lms-bucket/tests/seed-3/questions.json',
            totalMarks: 50,
            passingMarks: 25,
            duration: 60,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });

    console.log(`✅ Created Test 3: ${test3.title} (ID: ${test3.id})`);

    // Create a completed test result for testing
    const testResult = await prisma.testResult.create({
        data: {
            testId: test1.id,
            studentId: student.id,
            answersUrl: 's3://lms-bucket/results/seed-result-1/answers.json',
            resultUrl: 's3://lms-bucket/results/seed-result-1/evaluation.json',
            status: 'COMPLETED',
            totalScore: 16,
            percentage: 80.0,
            isPassed: true,
            aiModel: 'gemini-1.5-flash',
            submittedAt: new Date(),
            evaluatedAt: new Date()
        }
    });

    console.log(`✅ Created Test Result: ID ${testResult.id}`);

    // Create pending test results for other tests
    const testResult2 = await prisma.testResult.create({
        data: {
            testId: test2.id,
            studentId: student.id,
            status: 'NOT_STARTED'
        }
    });

    console.log(`✅ Created Test Result 2: ID ${testResult2.id}`);

    const testResult3 = await prisma.testResult.create({
        data: {
            testId: test3.id,
            studentId: student.id,
            status: 'NOT_STARTED'
        }
    });

    console.log(`✅ Created Test Result 3: ID ${testResult3.id}`);

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Created 3 tests`);
    console.log(`   - Created 3 test results`);
    console.log(`   - Assigned to student: ${student.name}`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

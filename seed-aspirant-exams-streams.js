const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting secondary seed for Aspirant, Exams, and Streams...');

    // 1. Ensure "Aspirant" Category exists
    console.log('Upserting Aspirant category...');
    const aspirantCategory = await prisma.category.upsert({
        where: { name: 'Aspirant' },
        update: {},
        create: { name: 'Aspirant' },
    });
    console.log(`- Ensured category: ${aspirantCategory.name}`);

    // 2. Seed Exams
    const examsList = ['NEET', 'JEE', 'UPSC', 'GATE', 'CAT', 'CLAT', 'NDA'];
    console.log('Seeding exams...');
    const examRecords = [];
    for (const examName of examsList) {
        const exam = await prisma.exam.upsert({
            where: { name: examName },
            update: {},
            create: { name: examName },
        });
        examRecords.push(exam);
        console.log(`- Ensured exam: ${exam.name}`);
    }

    // 3. Connect Exams to Aspirant Category
    console.log('Connecting exams to Aspirant category...');
    await prisma.category.update({
        where: { id: aspirantCategory.id },
        data: {
            exams: {
                connect: examRecords.map(e => ({ id: e.id }))
            }
        }
    });
    console.log('- Connected all exams to Aspirant');

    // 4. Seed Streams
    const streamsList = ['Science', 'Commerce', 'Arts', 'Humanities'];
    console.log('Seeding streams...');
    const streamRecords = [];
    for (const streamName of streamsList) {
        const stream = await prisma.stream.upsert({
            where: { name: streamName },
            update: {},
            create: { name: streamName },
        });
        streamRecords.push(stream);
        console.log(`- Ensured stream: ${stream.name}`);
    }

    // 5. Connect Streams to Class 11 and Class 12
    console.log('Connecting streams to Class 11 and Class 12...');
    const class11 = await prisma.category.findUnique({ where: { name: 'Class 11' } });
    const class12 = await prisma.category.findUnique({ where: { name: 'Class 12' } });

    if (class11 && class12) {
        const streamConnect = streamRecords.map(s => ({ id: s.id }));

        await prisma.category.update({
            where: { id: class11.id },
            data: { streams: { connect: streamConnect } }
        });
        console.log('- Connected streams to Class 11');

        await prisma.category.update({
            where: { id: class12.id },
            data: { streams: { connect: streamConnect } }
        });
        console.log('- Connected streams to Class 12');
    } else {
        console.log('! Class 11 or Class 12 not found. Skipping stream connection.');
    }

    // 6. Connect Streams to Boards (CBSE, ICSE, STATEBOARD)
    console.log('Connecting streams to specific boards (CBSE, ICSE, STATEBOARD)...');
    const boardNames = ['CBSE', 'ICSE', 'STATEBOARD'];
    const boards = await prisma.board.findMany({
        where: { name: { in: boardNames } }
    });

    const streamConnect = streamRecords.map(s => ({ id: s.id }));

    for (const board of boards) {
        await prisma.board.update({
            where: { id: board.id },
            data: {
                streams: {
                    connect: streamConnect
                }
            }
        });
        console.log(`- Connected streams to board: ${board.name}`);
    }

    console.log('\nSecondary seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

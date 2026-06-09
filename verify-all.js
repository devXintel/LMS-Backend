const prisma = require('./prismaClient');

async function main() {
    const boardCount = await prisma.board.count();
    const categoryCount = await prisma.category.count();
    const stateCount = await prisma.state.count();
    const mediumCount = await prisma.medium.count();
    const termCount = await prisma.term.count();
    const examCount = await prisma.exam.count();
    const streamCount = await prisma.stream.count();

    console.log('--- DATABASE SEED VERIFICATION ---');
    console.log(`Boards: ${boardCount}`);
    console.log(`Categories: ${categoryCount}`);
    console.log(`States: ${stateCount}`);
    console.log(`Mediums: ${mediumCount}`);
    console.log(`Terms: ${termCount}`);
    console.log(`Exams: ${examCount}`);
    console.log(`Streams: ${streamCount}`);

    console.log('\n--- Sample Terms ---');
    const terms = await prisma.term.findMany({ take: 5 });
    console.log(terms);

    console.log('\n--- Sample Mediums ---');
    const mediums = await prisma.medium.findMany({
        take: 5,
        include: { state: true }
    });
    console.log(mediums.map(m => `${m.name} (${m.state.name})`));

    console.log('\n--- Sample Exams Connected to Aspirant ---');
    const aspirant = await prisma.category.findUnique({
        where: { name: 'Aspirant' },
        include: { exams: true }
    });
    console.log(aspirant?.exams.map(e => e.name));

    console.log('\n--- Sample Streams Connected to Class 11 ---');
    const c11 = await prisma.category.findUnique({
        where: { name: 'Class 11' },
        include: { streams: true }
    });
    console.log(c11?.streams.map(s => s.name));

    console.log('\n--- Board Stream Connections ---');
    const boards = await prisma.board.findMany({
        include: { streams: true }
    });
    boards.forEach(b => {
        console.log(`${b.name}: ${b.streams.map(s => s.name).join(', ') || 'None'}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

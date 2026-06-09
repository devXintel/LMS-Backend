require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const neetSyllabus = [
    {
        "subject": "Physics",
        "chapters": [
            "Physical-world and measurement",
            "Kinematics",
            "Laws of Motion",
            "Work, Energy and Power",
            "Motion of System of Particles and Rigid Body",
            "Gravitation",
            "Properties of Bulk Matter",
            "Thermodynamics",
            "Behaviour of Perfect Gas and Kinetic Theory",
            "Oscillations and Waves",
            "Electrostatics",
            "Current Electricity",
            "Magnetic Effects of Current and Magnetism",
            "Electromagnetic Induction and Alternating Currents",
            "Electromagnetic Waves",
            "Optics",
            "Dual Nature of Matter and Radiation",
            "Atoms and Nuclei",
            "Electronic Devices"
        ]
    },
    {
        "subject": "Chemistry",
        "chapters": [
            "Some Basic Concepts of Chemistry",
            "Structure of Atom",
            "Classification of Elements and Periodicity in Properties",
            "Chemical Bonding and Molecular Structure",
            "Thermodynamics",
            "Equilibrium",
            "Redox Reactions",
            "Solutions",
            "Electrochemistry",
            "Chemical Kinetics",
            "Coordination Compounds",
            "p-Block Elements",
            "d and f Block Elements",
            "Haloalkanes and Haloarenes",
            "Alcohols, Phenols and Ethers",
            "Aldehydes, Ketones and Carboxylic Acids",
            "Organic Compounds Containing Nitrogen",
            "Biomolecules",
            "Organic Chemistry - Some Basic Principles and Techniques",
            "Hydrocarbons"
        ]
    },
    {
        "subject": "Biology",
        "chapters": [
            "Diversity in Living World",
            "Structural Organisation in Animals and Plants",
            "Cell Structure and Function",
            "Plant Physiology",
            "Human Physiology",
            "Reproduction",
            "Genetics and Evolution",
            "Biology and Human Welfare",
            "Biotechnology and Its Applications",
            "Ecology and environment"
        ]
    }
];

async function main() {
    console.log('Connecting to DB...');
    let connected = false;
    for (let i = 0; i < 5; i++) {
        try {
            await prisma.$connect();
            connected = true;
            break;
        } catch (err) {
            console.log('DB connection failed, retrying...', err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!connected) {
        console.error('Failed to connect to database.');
        return;
    }

    const exam = await prisma.exam.findFirst({
        where: { name: { contains: 'neet', mode: 'insensitive' } }
    });

    if (!exam) {
        console.log('No exam found matching NEET');
        return;
    }

    console.log(`Found exam NEET with ID: ${exam.id}`);

    const neetSyllabi = await prisma.examSyllabus.findMany({
        where: { examId: exam.id }
    });

    if (neetSyllabi.length === 0) {
        console.log('No exam_syllabus entries found for NEET');
        return;
    }

    console.log(`Updating ${neetSyllabi.length} NEET syllabi with chapters...`);

    for (const s of neetSyllabi) {
        await prisma.examSyllabus.update({
            where: { id: s.id },
            data: { chapters: neetSyllabus }
        });
        console.log(`Successfully updated syllabus ID: ${s.id}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

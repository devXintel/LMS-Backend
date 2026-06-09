const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Updating tests with sample questions...');

    // Sample questions for Test 1 (Photosynthesis - MCQ)
    const test1Questions = {
        questions: [
            {
                id: 1,
                text: "What is the primary function of chlorophyll in photosynthesis?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: [
                    "To absorb water",
                    "To absorb light energy",
                    "To release oxygen",
                    "To produce glucose"
                ],
                correctAnswer: "To absorb light energy"
            },
            {
                id: 2,
                text: "Which gas is released as a byproduct of photosynthesis?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: [
                    "Carbon dioxide",
                    "Nitrogen",
                    "Oxygen",
                    "Hydrogen"
                ],
                correctAnswer: "Oxygen"
            },
            {
                id: 3,
                text: "Where does photosynthesis primarily occur in plant cells?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: [
                    "Mitochondria",
                    "Nucleus",
                    "Chloroplasts",
                    "Ribosomes"
                ],
                correctAnswer: "Chloroplasts"
            },
            {
                id: 4,
                text: "What are the two main stages of photosynthesis?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: [
                    "Light reactions and dark reactions",
                    "Glycolysis and Krebs cycle",
                    "Transcription and translation",
                    "Mitosis and meiosis"
                ],
                correctAnswer: "Light reactions and dark reactions"
            },
            {
                id: 5,
                text: "Which of the following is NOT required for photosynthesis?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: [
                    "Sunlight",
                    "Water",
                    "Carbon dioxide",
                    "Oxygen"
                ],
                correctAnswer: "Oxygen"
            }
        ]
    };

    // Sample questions for Test 2 (Cell Biology - Handwritten)
    const test2Questions = {
        questions: [
            {
                id: 1,
                text: "Explain the structure and function of the cell membrane. Include details about the phospholipid bilayer and membrane proteins.",
                type: "HANDWRITTEN",
                marks: 10,
                rubric: "Should mention: phospholipid bilayer, selective permeability, membrane proteins (integral and peripheral), fluid mosaic model, transport mechanisms"
            },
            {
                id: 2,
                text: "Describe the process of cellular respiration and explain how it differs from photosynthesis.",
                type: "HANDWRITTEN",
                marks: 10,
                rubric: "Should mention: glycolysis, Krebs cycle, electron transport chain, ATP production, comparison with photosynthesis (energy input vs output, reactants and products)"
            },
            {
                id: 3,
                text: "What is the role of mitochondria in the cell? Explain why they are called the 'powerhouse' of the cell.",
                type: "HANDWRITTEN",
                marks: 10,
                rubric: "Should mention: ATP production, cellular respiration, double membrane structure, cristae, matrix, energy conversion"
            }
        ]
    };

    // Sample questions for Test 3 (General Science - Mixed)
    const test3Questions = {
        questions: [
            {
                id: 1,
                text: "What is the chemical formula for water?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: ["H2O", "CO2", "O2", "H2O2"],
                correctAnswer: "H2O"
            },
            {
                id: 2,
                text: "Which planet is known as the Red Planet?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: ["Venus", "Mars", "Jupiter", "Saturn"],
                correctAnswer: "Mars"
            },
            {
                id: 3,
                text: "Explain Newton's First Law of Motion with an example.",
                type: "HANDWRITTEN",
                marks: 10,
                rubric: "Should mention: law of inertia, object at rest stays at rest, object in motion stays in motion, unless acted upon by external force, provide real-world example"
            },
            {
                id: 4,
                text: "What is the speed of light in vacuum?",
                type: "MULTIPLE_CHOICE",
                marks: 2,
                options: [
                    "300,000 km/s",
                    "150,000 km/s",
                    "450,000 km/s",
                    "200,000 km/s"
                ],
                correctAnswer: "300,000 km/s"
            },
            {
                id: 5,
                text: "Describe the water cycle and explain the importance of each stage.",
                type: "HANDWRITTEN",
                marks: 10,
                rubric: "Should mention: evaporation, condensation, precipitation, collection, importance of each stage in maintaining Earth's water balance"
            }
        ]
    };

    // Update tests with questions
    const tests = await prisma.test.findMany({
        where: { assignedTo: 57 },
        orderBy: { id: 'asc' }
    });

    if (tests.length >= 3) {
        await prisma.test.update({
            where: { id: tests[0].id },
            data: { questionsUrl: JSON.stringify(test1Questions) }
        });
        console.log(`✅ Updated Test 1 with ${test1Questions.questions.length} MCQ questions`);

        await prisma.test.update({
            where: { id: tests[1].id },
            data: { questionsUrl: JSON.stringify(test2Questions) }
        });
        console.log(`✅ Updated Test 2 with ${test2Questions.questions.length} handwritten questions`);

        await prisma.test.update({
            where: { id: tests[2].id },
            data: { questionsUrl: JSON.stringify(test3Questions) }
        });
        console.log(`✅ Updated Test 3 with ${test3Questions.questions.length} mixed questions`);
    }

    console.log('\n🎉 Tests updated successfully with sample questions!');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Evaluate a multiple choice question
 */
async function evaluateMultipleChoice(question, studentAnswer) {
    // 1. Normalize options
    let options = [];
    if (Array.isArray(question.options)) {
        options = question.options;
    } else {
        options = [question.option_a, question.option_b, question.option_c, question.option_d].filter(o => o !== undefined && o !== null);
    }

    // 2. Normalize correctAnswer
    let correctAnswer = question.correctAnswer || question.correct_answer;

    // 3. Compare studentAnswer (could be index or text string)
    let isCorrect = false;
    let correctOptionText = "";
    let correctIndex = -1;

    if (typeof correctAnswer === 'string') {
        if (correctAnswer.toLowerCase() === 'option_a') {
            correctIndex = 0;
            correctOptionText = question.option_a || "";
        } else if (correctAnswer.toLowerCase() === 'option_b') {
            correctIndex = 1;
            correctOptionText = question.option_b || "";
        } else if (correctAnswer.toLowerCase() === 'option_c') {
            correctIndex = 2;
            correctOptionText = question.option_c || "";
        } else if (correctAnswer.toLowerCase() === 'option_d') {
            correctIndex = 3;
            correctOptionText = question.option_d || "";
        } else {
            correctOptionText = correctAnswer;
            if (options.length > 0) {
                correctIndex = options.indexOf(correctAnswer);
            }
        }
    }

    if (typeof studentAnswer === 'number') {
        if (correctIndex !== -1 && studentAnswer === correctIndex) {
            isCorrect = true;
        } else if (options[studentAnswer] && options[studentAnswer] === correctOptionText) {
            isCorrect = true;
        }
    } else if (studentAnswer !== undefined && studentAnswer !== null && !isNaN(studentAnswer)) {
        const studentIdx = parseInt(studentAnswer);
        if (correctIndex !== -1 && studentIdx === correctIndex) {
            isCorrect = true;
        } else if (options[studentIdx] && options[studentIdx] === correctOptionText) {
            isCorrect = true;
        }
    } else if (typeof studentAnswer === 'string') {
        if (studentAnswer === correctOptionText) {
            isCorrect = true;
        } else if (studentAnswer.toLowerCase() === 'option_a' && correctIndex === 0) {
            isCorrect = true;
        } else if (studentAnswer.toLowerCase() === 'option_b' && correctIndex === 1) {
            isCorrect = true;
        } else if (studentAnswer.toLowerCase() === 'option_c' && correctIndex === 2) {
            isCorrect = true;
        } else if (studentAnswer.toLowerCase() === 'option_d' && correctIndex === 3) {
            isCorrect = true;
        }
    }

    return {
        questionId: question.id || question.questionId,
        type: 'MULTIPLE_CHOICE',
        score: isCorrect ? (question.marks || 1) : 0,
        maxScore: question.marks || 1,
        isCorrect,
        studentAnswer,
        correctAnswer: correctOptionText || correctAnswer,
        feedback: isCorrect
            ? "Correct! Well done."
            : `Incorrect. The correct answer is: ${correctOptionText || correctAnswer}`
    };
}

/**
 * Extract text from handwritten image using Gemini Vision
 */
async function extractTextFromImage(imageBase64) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Extract all text from this handwritten answer. Return only the text content, no additional commentary or formatting.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();
        return text.trim();
    } catch (error) {
        console.error('OCR extraction error:', error);
        throw new Error('Failed to extract text from image');
    }
}

/**
 * Evaluate handwritten/essay answer using Gemini AI
 */
async function evaluateHandwritten(question, extractedText, imageBase64) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are an expert teacher evaluating a student's answer.

**Question:** ${question.text}
**Maximum Marks:** ${question.marks}
**Correct Answer/Rubric:** ${question.rubric || question.correctAnswer || "Use your expert knowledge to evaluate"}

**Student's Answer (OCR extracted):** 
${extractedText}

Evaluate the answer fairly and provide constructive feedback. Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "score": <number between 0 and ${question.marks}>,
  "feedback": "<detailed constructive feedback in 2-3 sentences>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "confidence": <number between 0.0 and 1.0>
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response (handle markdown code blocks)
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        const evaluation = JSON.parse(jsonText);

        return {
            questionId: question.id,
            type: 'HANDWRITTEN',
            score: evaluation.score,
            maxScore: question.marks,
            extractedText,
            feedback: evaluation.feedback,
            aiConfidence: evaluation.confidence,
            strengths: evaluation.strengths || [],
            improvements: evaluation.improvements || []
        };
    } catch (error) {
        console.error('Handwritten evaluation error:', error);
        throw new Error('Failed to evaluate handwritten answer');
    }
}

/**
 * Helper to fetch questions from a local seed mapping or JSON string
 */
async function getQuestionsFromUrl(questionsUrl) {
    if (!questionsUrl) return { questions: [] };

    const trimmed = questionsUrl.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? { questions: parsed } : parsed;
        } catch (e) {
            console.error('Failed to parse questions JSON:', e);
        }
    }

    if (questionsUrl.includes('seed-1/questions.json')) {
        return {
            questions: [
                { id: 1, text: "What is the primary function of chlorophyll in photosynthesis?", type: "MULTIPLE_CHOICE", marks: 2, options: ["To absorb water", "To absorb light energy", "To release oxygen", "To produce glucose"], correctAnswer: "To absorb light energy" },
                { id: 2, text: "Which gas is released as a byproduct of photosynthesis?", type: "MULTIPLE_CHOICE", marks: 2, options: ["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"], correctAnswer: "Oxygen" },
                { id: 3, text: "Where does photosynthesis primarily occur in plant cells?", type: "MULTIPLE_CHOICE", marks: 2, options: ["Mitochondria", "Nucleus", "Chloroplasts", "Ribosomes"], correctAnswer: "Chloroplasts" },
                { id: 4, text: "What are the two main stages of photosynthesis?", type: "MULTIPLE_CHOICE", marks: 2, options: ["Light reactions and dark reactions", "Glycolysis and Krebs cycle", "Transcription and translation", "Mitosis and meiosis"], correctAnswer: "Light reactions and dark reactions" },
                { id: 5, text: "Which of the following is NOT required for photosynthesis?", type: "MULTIPLE_CHOICE", marks: 2, options: ["Sunlight", "Water", "Carbon dioxide", "Oxygen"], correctAnswer: "Oxygen" }
            ]
        };
    }

    if (questionsUrl.includes('seed-2/questions.json')) {
        return {
            questions: [
                { id: 1, text: "Explain the structure and function of the cell membrane. Include details about the phospholipid bilayer and membrane proteins.", type: "HANDWRITTEN", marks: 10, rubric: "Should mention: phospholipid bilayer, selective permeability, membrane proteins (integral and peripheral), fluid mosaic model, transport mechanisms" },
                { id: 2, text: "Describe the process of cellular respiration and explain how it differs from photosynthesis.", type: "HANDWRITTEN", marks: 10, rubric: "Should mention: glycolysis, Krebs cycle, electron transport chain, ATP production, comparison with photosynthesis (energy input vs output, reactants and products)" },
                { id: 3, text: "What is the role of mitochondria in the cell? Explain why they are called the 'powerhouse' of the cell.", type: "HANDWRITTEN", marks: 10, rubric: "Should mention: ATP production, cellular respiration, double membrane structure, cristae, matrix, energy conversion" }
            ]
        };
    }

    if (questionsUrl.includes('seed-3/questions.json')) {
        return {
            questions: [
                { id: 1, text: "What is the chemical formula for water?", type: "MULTIPLE_CHOICE", marks: 2, options: ["H2O", "CO2", "O2", "H2O2"], correctAnswer: "H2O" },
                { id: 2, text: "Which planet is known as the Red Planet?", type: "MULTIPLE_CHOICE", marks: 2, options: ["Venus", "Mars", "Jupiter", "Saturn"], correctAnswer: "Mars" },
                { id: 3, text: "Explain Newton's First Law of Motion with an example.", type: "HANDWRITTEN", marks: 10, rubric: "Should mention: law of inertia, object at rest stays at rest, object in motion stays in motion, unless acted upon by external force, provide real-world example" },
                { id: 4, text: "What is the speed of light in vacuum?", type: "MULTIPLE_CHOICE", marks: 2, options: ["300,000 km/s", "150,000 km/s", "450,000 km/s", "200,000 km/s"], correctAnswer: "300,000 km/s" },
                { id: 5, text: "Describe the water cycle and explain the importance of each stage.", type: "HANDWRITTEN", marks: 10, rubric: "Should mention: evaporation, condensation, precipitation, collection, importance of each stage in maintaining Earth's water balance" }
            ]
        };
    }

    if (questionsUrl.startsWith('http')) {
        try {
            const fetch = require('node-fetch');
            const res = await fetch(questionsUrl);
            const parsed = await res.json();
            return Array.isArray(parsed) ? { questions: parsed } : parsed;
        } catch (e) {
            console.error('Failed to fetch questions from URL:', e);
        }
    }

    return { questions: [] };
}

/**
 * Main function to evaluate an entire test
 */
async function evaluateTest(testResultId) {
    try {
        console.log(`Starting evaluation for test result ID: ${testResultId}`);

        // Get test result with test details
        const testResult = await prisma.testResult.findUnique({
            where: { id: testResultId },
            include: { test: true }
        });

        if (!testResult) {
            throw new Error('Test result not found');
        }

        if (!testResult.answersUrl) {
            throw new Error('No answers submitted');
        }

        // Parse answers from JSON (in real app, fetch from S3)
        const answersData = JSON.parse(testResult.answersUrl);
        const questionsData = await getQuestionsFromUrl(testResult.test.questionsUrl);

        const questionResults = [];
        let totalScore = 0;

        // Evaluate each question
        for (const question of questionsData.questions) {
            const studentAnswer = answersData.answers.find(a => a.questionId === question.id);

            if (!studentAnswer || (!studentAnswer.selectedAnswer && !studentAnswer.imageBase64)) {
                // Question not answered or answer is empty
                questionResults.push({
                    questionId: question.id,
                    type: question.type,
                    score: 0,
                    maxScore: question.marks,
                    isCorrect: false,
                    studentAnswer: question.type === 'MULTIPLE_CHOICE' ? 'Not answered' : undefined,
                    correctAnswer: question.type === 'MULTIPLE_CHOICE' ? question.correctAnswer : undefined,
                    feedback: "Question not answered. No marks awarded."
                });
                continue;
            }

            let result;

            if (question.type === 'MULTIPLE_CHOICE') {
                result = await evaluateMultipleChoice(question, studentAnswer.selectedAnswer);
            } else if (question.type === 'HANDWRITTEN') {
                if (!studentAnswer.imageBase64) {
                    // No image uploaded
                    questionResults.push({
                        questionId: question.id,
                        type: 'HANDWRITTEN',
                        score: 0,
                        maxScore: question.marks,
                        feedback: "No handwritten answer uploaded. No marks awarded."
                    });
                    continue;
                }

                // In real app, download image from S3 and convert to base64
                const extractedText = await extractTextFromImage(studentAnswer.imageBase64);
                result = await evaluateHandwritten(question, extractedText, studentAnswer.imageBase64);
            }

            totalScore += result.score;
            questionResults.push(result);
        }

        const percentage = (totalScore / testResult.test.totalMarks) * 100;
        const isPassed = totalScore >= testResult.test.passingMarks;

        // Create evaluation result
        const evaluationResult = {
            testResultId,
            evaluatedAt: new Date().toISOString(),
            aiModel: "gemini-1.5-flash",
            totalScore,
            maxScore: testResult.test.totalMarks,
            percentage: parseFloat(percentage.toFixed(2)),
            isPassed,
            questionResults
        };

        // In real app, upload to S3. For now, store as JSON string
        const resultUrl = JSON.stringify(evaluationResult);

        // Update test result
        await prisma.testResult.update({
            where: { id: testResultId },
            data: {
                status: 'COMPLETED',
                totalScore,
                percentage: parseFloat(percentage.toFixed(2)),
                isPassed,
                resultUrl,
                aiModel: 'gemini-1.5-flash',
                evaluatedAt: new Date()
            }
        });

        console.log(`Evaluation completed for test result ID: ${testResultId}`);
        console.log(`Score: ${totalScore}/${testResult.test.totalMarks} (${percentage.toFixed(2)}%)`);

        return evaluationResult;
    } catch (error) {
        console.error('Test evaluation error:', error);

        // Update status to failed
        await prisma.testResult.update({
            where: { id: testResultId },
            data: { status: 'FAILED_EVALUATION' }
        });

        throw error;
    }
}

module.exports = {
    evaluateTest,
    evaluateMultipleChoice,
    evaluateHandwritten,
    extractTextFromImage
};

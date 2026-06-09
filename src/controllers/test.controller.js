const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get all tests for a student
exports.getStudentTests = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get student's academic profile to find their category
        const userProfile = await prisma.userAcademicProfile.findUnique({
            where: {
                userId: parseInt(studentId)
            }
        });

        // Get tests assigned to this student, filter by category if profile is set
        const whereClause = {
            assignedTo: parseInt(studentId)
        };
        if (userProfile && userProfile.category) {
            whereClause.category = userProfile.category;
        }

        const tests = await prisma.test.findMany({
            where: whereClause,
            include: {
                results: {
                    where: {
                        studentId: parseInt(studentId)
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(tests);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ error: 'Failed to fetch tests' });
    }
};

// Get test results for a student
exports.getTestResults = async (req, res) => {
    try {
        const { studentId } = req.params;

        const results = await prisma.testResult.findMany({
            where: {
                studentId: parseInt(studentId),
                status: 'COMPLETED'
            },
            include: {
                test: true
            },
            orderBy: {
                evaluatedAt: 'desc'
            },
            take: 5 // Get last 5 results
        });

        res.json(results);
    } catch (error) {
        console.error('Error fetching test results:', error);
        res.status(500).json({ error: 'Failed to fetch test results' });
    }
};

// Get single test details
exports.getTestById = async (req, res) => {
    try {
        const { testId } = req.params;

        const test = await prisma.test.findUnique({
            where: {
                id: parseInt(testId)
            }
        });

        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }

        res.json(test);
    } catch (error) {
        console.error('Error fetching test:', error);
        res.status(500).json({ error: 'Failed to fetch test' });
    }
};

// Get test result details
exports.getTestResultById = async (req, res) => {
    try {
        const { resultId } = req.params;

        const result = await prisma.testResult.findUnique({
            where: {
                id: parseInt(resultId)
            },
            include: {
                test: true
            }
        });

        if (!result) {
            return res.status(404).json({ error: 'Test result not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching test result:', error);
        res.status(500).json({ error: 'Failed to fetch test result' });
    }
};

// Submit test answers
exports.submitTest = async (req, res) => {
    try {
        const { testId } = req.params;
        const { studentId, answers } = req.body;

        // Check if test exists
        const test = await prisma.test.findUnique({
            where: { id: parseInt(testId) }
        });

        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }

        // Check if student already has a result for this test
        let testResult = await prisma.testResult.findFirst({
            where: {
                testId: parseInt(testId),
                studentId: parseInt(studentId)
            }
        });

        // Store answers as JSON (in real app, upload to S3)
        const answersUrl = JSON.stringify({ answers });

        if (testResult) {
            // Update existing result
            testResult = await prisma.testResult.update({
                where: { id: testResult.id },
                data: {
                    answersUrl,
                    status: 'EVALUATING',
                    submittedAt: new Date()
                }
            });
        } else {
            // Create new result
            testResult = await prisma.testResult.create({
                data: {
                    testId: parseInt(testId),
                    studentId: parseInt(studentId),
                    answersUrl,
                    status: 'EVALUATING',
                    submittedAt: new Date()
                }
            });
        }

        // Trigger AI evaluation asynchronously
        const aiEvaluation = require('../services/ai-evaluation.service');
        aiEvaluation.evaluateTest(testResult.id)
            .then(() => console.log(`✅ Evaluation completed for test result ${testResult.id}`))
            .catch(err => console.error(`❌ Evaluation failed for test result ${testResult.id}:`, err));

        res.json({
            message: 'Test submitted successfully. AI evaluation in progress.',
            testResultId: testResult.id
        });
    } catch (error) {
        console.error('Error submitting test:', error);
        res.status(500).json({ error: 'Failed to submit test' });
    }
};

// Get detailed test results with AI feedback
exports.getDetailedResults = async (req, res) => {
    try {
        const { resultId } = req.params;

        const testResult = await prisma.testResult.findUnique({
            where: { id: parseInt(resultId) },
            include: { test: true }
        });

        if (!testResult) {
            return res.status(404).json({ error: 'Test result not found' });
        }

        // Parse evaluation results
        let evaluationData = null;
        if (testResult.resultUrl) {
            try {
                evaluationData = JSON.parse(testResult.resultUrl);
            } catch (e) {
                console.error('Failed to parse evaluation data:', e);
            }
        }

        res.json({
            ...testResult,
            evaluation: evaluationData
        });
    } catch (error) {
        console.error('Error fetching detailed results:', error);
        res.status(500).json({ error: 'Failed to fetch detailed results' });
    }
};

// ------------------------------------------------------------
// Generate test questions from a video URL (placeholder logic)
// ------------------------------------------------------------
exports.generateFromVideo = async (req, res) => {
  try {
    const { videoUrl, subject, chapter, subtopic, language } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl is required' });
    }

    // Placeholder: create simple mock questions using supplied metadata.
    const mockQuestions = [
      {
        questionId: 1,
        text: `What key topic does the video about "${chapter}" cover?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
      },
      {
        questionId: 2,
        text: `Summarize the main point of the video segment on "${subtopic}".`,
        options: [],
        correctAnswer: '',
      },
    ];

    // Respond in the shape the frontend expects.
    res.json({
      testId: null,
      videoUrl,
      questions: mockQuestions,
      message: 'Mock video‑based test generated.',
    });
  } catch (err) {
    console.error('[Video Test Generation] Error:', err);
    res.status(500).json({ error: 'Failed to generate test from video' });
  }
};

// ------------------------------------------------------------
// Generate test questions automatically using AI based on topic/video script
// ------------------------------------------------------------
exports.generateFromTopic = async (req, res) => {
  try {
    const { subject, chapter, subtopic, language, studentId } = req.body;
    
    // Pull the lesson script from LessonCache if it exists for this topic
    let lessonContext = "";
    try {
      const slugify = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 80);
      const searchSlug = slugify(subtopic || chapter);
      
      const node = await prisma.contentNode.findFirst({
        where: { slug: searchSlug }
      });
      
      if (node) {
        const cache = await prisma.lessonCache.findFirst({
          where: { contentNodeId: node.id }
        });
        if (cache && cache.lessonText) {
          lessonContext = cache.lessonText.substring(0, 4000); // Send up to 4000 chars of the lesson to AI
        }
      }
    } catch (e) {
      console.log('Could not fetch lesson context for test generation', e);
    }

    const isTamil = language === 'tamil' || language === 'ta';
    
    const prompt = `You are an expert teacher creating a multiple choice test.
Subject: ${subject}
Chapter: ${chapter}
Topic: ${subtopic || chapter}

${lessonContext ? `Here is the transcript of the video lesson taught to the student. Base your questions heavily on this content:\n${lessonContext}\n` : ''}

Generate exactly 5 multiple choice questions about this topic. 
${isTamil ? "CRITICAL: The generated questions, options, and correctAnswer MUST be in Tamil language." : "The questions MUST be in English."}

Return ONLY a valid JSON object with the exact structure below (no markdown, no backticks, no comments):
{
  "questions": [
    {
      "questionId": 1,
      "text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Using 8b model to avoid TPD quota limits of 70b
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`Groq API Error: ${response.status} ${errTxt}`);
    }

    const result = await response.json();
    let text = result.choices[0]?.message?.content || "";
    if (text.startsWith('```')) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(text);
    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error("AI returned empty questions");
    }

    // Ensure questionIds are set
    const questions = parsed.questions.map((q, idx) => ({
      ...q,
      questionId: idx + 1
    }));

    // Persist test in database if studentId is provided
    let testId = null;
    if (studentId) {
      const assignedUserId = parseInt(studentId);
      let studentCategory = 'Aspirant';
      try {
        const userProfile = await prisma.userAcademicProfile.findUnique({
          where: { userId: assignedUserId }
        });
        if (userProfile && userProfile.category) {
          studentCategory = userProfile.category;
        }
      } catch (e) {
        console.log('Error fetching user profile for test generation:', e);
      }

      const test = await prisma.test.create({
        data: {
          title: `AI Test: ${subtopic || chapter}`,
          description: `Quiz based on lesson ${subtopic || chapter}`,
          aiModel: 'llama-3.1-8b-instant',
          topic: subtopic || chapter,
          difficulty: 'EASY',
          category: studentCategory,
          assignedTo: assignedUserId,
          type: 'MULTIPLE_CHOICE',
          questionsUrl: JSON.stringify({ questions }),
          totalMarks: questions.length * 2, // 2 marks per question
          passingMarks: Math.ceil(questions.length),
          duration: 15
        }
      });
      testId = test.id;
    }

    res.json({
      testId,
      questions,
      message: 'AI generated test successfully.'
    });

  } catch (err) {
    console.error('[Test Gen] AI Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate test questions using AI', details: err.message });
  }
};


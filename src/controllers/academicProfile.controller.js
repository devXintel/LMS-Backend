const prisma = require('../config/prisma');

/* CREATE/UPDATE ACADEMIC PROFILE */
/* CREATE/UPDATE ACADEMIC PROFILE */
exports.saveAcademicProfile = async (req, res) => {
    const { userId, category, board, state, medium, examType, schoolName, stream } = req.body;

    try {
        // Validate required fields
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Determine target role based on input
        let targetRole = null;

        if (examType) {
            // If exam type is provided (e.g. NEET, JEE), they are an Aspirant
            targetRole = 'aspirant';
        } else if (category && category.match(/Class \d+/i)) {
            // If category is "Class 1" through "Class 12", they are a Student
            targetRole = 'student';
        }

        // Update user role if determined
        if (targetRole) {
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: { role: targetRole }
            });
        }

        // Create or update academic profile
        // Construct update data dynamically to facilitate partial updates (PATCH behavior)
        // Prisma ignores 'undefined' fields in update, allowing us to only change what's sent.

        const updateData = {};
        if (category !== undefined) updateData.category = category;
        if (board !== undefined) updateData.board = board;
        if (state !== undefined) updateData.state = state;
        if (medium !== undefined) updateData.medium = medium;
        if (examType !== undefined) updateData.exam = examType;
        if (schoolName !== undefined) updateData.schoolName = schoolName;
        if (stream !== undefined) updateData.stream = stream;

        const academicProfile = await prisma.userAcademicProfile.upsert({
            where: { userId: parseInt(userId) },
            update: updateData,
            create: {
                userId: parseInt(userId),
                category: category || null,
                board: board || null,
                state: state || null,
                medium: medium || null,
                exam: examType || null,
                schoolName: schoolName || null,
                stream: stream || null
            }
        });

        // Also save to Enrollment table if it's a "complete" profile step
        // (i.e. if it has a category and either an exam or a board/state/medium)
        const isComplete = !!(category && (examType || (board && (!state || state) && (!medium || medium))));
        
        if (isComplete) {
            await prisma.enrollment.create({
                data: {
                    userId: parseInt(userId),
                    category: category || null,
                    board: board || null,
                    state: state || null,
                    medium: medium || null,
                    exam: examType || null,
                    stream: stream || null,
                    mediumId: null // Can be updated later if needed
                }
            });
        }

        res.json({
            message: 'Academic profile saved successfully',
            profile: academicProfile
        });

    } catch (error) {
        console.error('Save academic profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  GET ACADEMIC PROFILE */
exports.getAcademicProfile = async (req, res) => {
    const { userId } = req.params;

    try {
        const profile = await prisma.userAcademicProfile.findUnique({
            where: { userId: parseInt(userId) }
        });

        if (!profile) {
            return res.status(404).json({ message: 'Academic profile not found' });
        }

        res.json({ profile });

    } catch (error) {
        console.error('Get academic profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  UPDATE BOARD SELECTION  */
exports.updateBoardSelection = async (req, res) => {
    const { userId, board, state, medium } = req.body;

    try {
        if (!userId || !board) {
            return res.status(400).json({ message: 'User ID and board are required' });
        }

        const profile = await prisma.userAcademicProfile.upsert({
            where: { userId: parseInt(userId) },
            update: {
                board,
                // If board changes, clear state/medium/stream to force re-selection logic
                state: null,
                medium: null,
                stream: null
            },
            create: {
                userId: parseInt(userId),
                board,
                state: null,
                medium: null,
                stream: null
            }
        });

        res.json({
            message: 'Board selection saved successfully',
            profile
        });

    } catch (error) {
        console.error('Update board selection error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  UPDATE EXAM TYPE  */
exports.updateExamType = async (req, res) => {
    const { userId, examType } = req.body;

    try {
        if (!userId || !examType) {
            return res.status(400).json({ message: 'User ID and exam type are required' });
        }

        const profile = await prisma.userAcademicProfile.upsert({
            where: { userId: parseInt(userId) },
            update: { exam: examType },
            create: {
                userId: parseInt(userId),
                exam: examType
            }
        });

        res.json({
            message: 'Exam type updated successfully',
            profile
        });

    } catch (error) {
        console.error('Update exam type error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  UPDATE STATE AND MEDIUM  */
exports.updateStateAndMedium = async (req, res) => {
    const { userId, state, medium } = req.body;

    try {
        if (!userId || !state || !medium) {
            return res.status(400).json({ message: 'User ID, state, and medium are required' });
        }

        const profile = await prisma.userAcademicProfile.upsert({
            where: { userId: parseInt(userId) },
            update: {
                state,
                medium
            },
            create: {
                userId: parseInt(userId),
                state,
                medium
            }
        });

        res.json({
            message: 'State and medium updated successfully',
            profile
        });

    } catch (error) {
        console.error('Update state and medium error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* UPDATE STREAM */
exports.updateStream = async (req, res) => {
    const { userId, stream } = req.body;

    try {
        if (!userId || !stream) {
            return res.status(400).json({ message: 'User ID and stream are required' });
        }

        const profile = await prisma.userAcademicProfile.upsert({
            where: { userId: parseInt(userId) },
            update: { stream },
            create: {
                userId: parseInt(userId),
                stream
            }
        });

        res.json({
            message: 'Stream updated successfully',
            profile
        });

    } catch (error) {
        console.error('Update stream error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* GET ALL ENROLLMENTS FOR A USER */
exports.getAllEnrollments = async (req, res) => {
    const { userId } = req.params;

    try {
        const enrollments = await prisma.enrollment.findMany({
            where: { userId: parseInt(userId) },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ enrollments });

    } catch (error) {
        const isDbDown = error.message?.includes("Can't reach database") ||
                         error.message?.includes("connection") ||
                         error.code === 'P1001' || error.code === 'P1008' || error.code === 'P1017';
        if (isDbDown) {
            console.warn('Get all enrollments: DB unreachable — returning empty list.');
            return res.status(503).json({ enrollments: [], error: 'Database temporarily unavailable.', retryable: true });
        }
        console.error('Get all enrollments error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* SWITCH ACTIVE ENROLLMENT */
exports.switchEnrollment = async (req, res) => {
    const { userId, enrollmentId } = req.body;

    try {
        if (!userId || !enrollmentId) {
            return res.status(400).json({ message: 'User ID and Enrollment ID are required' });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: { id: parseInt(enrollmentId) }
        });

        if (!enrollment || enrollment.userId !== parseInt(userId)) {
            return res.status(404).json({ message: 'Enrollment not found' });
        }

        // Update the active UserAcademicProfile with data from the enrollment
        const profile = await prisma.userAcademicProfile.upsert({
            where: { userId: parseInt(userId) },
            update: {
                category: enrollment.category,
                board: enrollment.board,
                state: enrollment.state,
                medium: enrollment.medium,
                exam: enrollment.exam,
                stream: enrollment.stream,
                mediumId: enrollment.mediumId
            },
            create: {
                userId: parseInt(userId),
                category: enrollment.category,
                board: enrollment.board,
                state: enrollment.state,
                medium: enrollment.medium,
                exam: enrollment.exam,
                stream: enrollment.stream,
                mediumId: enrollment.mediumId
            }
        });

        // Determine target role for user based on new profile
        let targetRole = 'student';
        if (enrollment.exam) {
            targetRole = 'aspirant';
        }

        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { role: targetRole }
        });

        res.json({
            message: 'Enrollment switched successfully',
            profile
        });

    } catch (error) {
        console.error('Switch enrollment error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/* RESET ACADEMIC PROFILE (Start new enrollment) */
exports.resetAcademicProfile = async (req, res) => {
    const { userId } = req.body;

    try {
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const profile = await prisma.userAcademicProfile.update({
            where: { userId: parseInt(userId) },
            data: {
                category: null,
                board: null,
                state: null,
                medium: null,
                exam: null,
                stream: null,
                schoolName: null,
                termId: null,
                mediumId: null
            }
        });

        res.json({
            message: 'Academic profile reset successfully',
            profile
        });

    } catch (error) {
        console.error('Reset academic profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


module.exports = {
    saveAcademicProfile: exports.saveAcademicProfile,
    getAcademicProfile: exports.getAcademicProfile,
    updateBoardSelection: exports.updateBoardSelection,
    updateExamType: exports.updateExamType,
    updateStateAndMedium: exports.updateStateAndMedium,
    updateStream: exports.updateStream,
    resetAcademicProfile: exports.resetAcademicProfile,
    getAllEnrollments: exports.getAllEnrollments,
    switchEnrollment: exports.switchEnrollment
};

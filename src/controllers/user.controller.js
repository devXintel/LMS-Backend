const prisma = require("../config/prisma")


const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                isActive: true,
                payments: {
                    where: {
                        status: 'Success'
                    },
                    orderBy: {
                        date: 'desc'
                    },
                    take: 1,
                    select: {
                        planName: true
                    }
                },
                academicProfile: {
                    select: {
                        schoolName: true,
                        category: true,
                        board: true,
                        state: true,
                        medium: true,
                        exam: true,
                        stream: true
                    }
                }
            }
        });

        // Transform data to match frontend expectations if necessary
        const formattedUsers = users.map(user => {
            let classOrExam = "-";
            if (user.academicProfile) {
                // Determine what to show in "Class / Exam" column
                // Prioritize Exam if present, otherwise Category
                if (user.academicProfile.exam) {
                    classOrExam = user.academicProfile.exam;
                } else if (user.academicProfile.category) {
                    classOrExam = user.academicProfile.category;
                }
            }
            return {
                ...user,
                phone: user.phone ? user.phone.toString() : "-",
                plan: user.role === 'admin' ? '-' : (user.payments[0]?.planName || "-"),
                classOrExam,
                // Flatten new fields for easier frontend access
                schoolName: user.academicProfile?.schoolName || "-",
                category: user.academicProfile?.category || "-",
                board: user.academicProfile?.board || "-",
                state: user.academicProfile?.state || "-",
                medium: user.academicProfile?.medium || "-",
                stream: user.academicProfile?.stream || "-",
                exam: user.academicProfile?.exam || "-",
            };
        });

        // console.log("[DEBUG] Sample formatted user:", formattedUsers[0]);

        res.json(formattedUsers);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
};

const getUserStats = async (req, res) => {
    try {
        const count = await prisma.user.count();

        const studentCount = await prisma.user.count({
            where: {
                role: {
                    equals: 'student',
                    mode: 'insensitive'
                }
            }
        });

        const aspirantCount = await prisma.user.count({
            where: {
                role: {
                    equals: 'aspirant',
                    mode: 'insensitive'
                }
            }
        });

        // "Active Courses" are the total number of syllabi uploaded
        const examSyllabiCount = await prisma.examSyllabus.count();
        const subjectSyllabiCount = await prisma.subjectSyllabus.count();
        const activeCourses = examSyllabiCount + subjectSyllabiCount;

        const totalRevenueResult = await prisma.paymentDetail.aggregate({
            _sum: {
                amount: true
            },
            where: {
                status: 'Success'
            }
        });
        const totalRevenue = totalRevenueResult._sum.amount || 0;

        // Count users with active subscriptions (planId is not null)
        const activeSubscriptions = await prisma.user.count({
            where: {
                planId: {
                    not: null
                }
            }
        });

        res.json({ count, studentCount, aspirantCount, activeCourses, totalRevenue, activeSubscriptions });
    } catch (error) {
        console.error("Error in getUserStats:", error);
        res.status(500).json({ error: 'Error fetching user stats', details: error.message });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    // Allow reason from body OR query parameter as fallback
    const reason = req.body.reason || req.query.reason;



    try {
        const userId = parseInt(id);

        // Find user to get email
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {

            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user
        await prisma.user.delete({
            where: { id: userId }
        });


        // Send Email if transporter is configured
        const nodemailer = require('nodemailer');

        try {

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const emailText = `Dear ${user.name},\n\nYour account has been deleted from our system.\n\nReason: ${reason || 'No specific reason provided.'}\n\nIf you believe this is a mistake, please contact support.\n\nRegards,\nLMS Admin Team`;

            const mailOptions = {
                from: process.env.EMAIL_USER, // sender address
                to: user.email, // list of receivers
                subject: "Account Deletion Notification - LMS Admin",
                text: emailText,
            };

            const info = await transporter.sendMail(mailOptions);


        } catch (emailError) {
            console.error('[DEBUG] Error sending email:', emailError);
            // Don't fail the request if email fails, but log it
        }

        res.json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error("[DEBUG] Delete Error:", error);
        res.status(500).json({ error: 'Error deleting user' });
    }
};

// Update user profile
const updateUserProfile = async (req, res) => {
    const { userId, name, age, gender, phone, category, schoolName, state, district, pincode, profilepic } = req.body;

    try {
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Build update data object
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (age !== undefined) updateData.age = age ? parseInt(age) : null;
        if (gender !== undefined) updateData.gender = gender;
        if (phone !== undefined) updateData.phone = phone ? BigInt(phone) : null;

        // Handle Role update based on category
        // Note: Changing role might have implications, but user requested editable basic info.
        if (category !== undefined) {
            updateData.role = category.toLowerCase() === 'student' ? 'student' : 'aspirant';
        }

        const id = parseInt(userId);

        // Transaction to update all related tables
        const updatedUser = await prisma.$transaction(async (tx) => {
            // 1. Update User table
            const user = await tx.user.update({
                where: { id },
                data: updateData,
                include: {
                    userInfo: true,
                    academicProfile: true
                }
            });

            // 2. Upsert UserInfo (State, District, Pincode, ProfilePic)
            if (state !== undefined || district !== undefined || pincode !== undefined || profilepic !== undefined) {
                await tx.userInfo.upsert({
                    where: { userId: id },
                    create: {
                        userId: id,
                        state: state || null,
                        district: district || null,
                        pincode: pincode ? parseInt(pincode) : null,
                        profilepic: profilepic || null
                    },
                    update: {
                        state: state !== undefined ? state : undefined,
                        district: district !== undefined ? district : undefined,
                        pincode: pincode !== undefined ? (pincode ? parseInt(pincode) : null) : undefined,
                        profilepic: profilepic !== undefined ? profilepic : undefined
                    }
                });
            }

            // 3. Upsert UserAcademicProfile (School Name)
            // Only strictly needed if role is student, but we can store it regardless or check role.
            // Let's check the current role (or updated role)
            const currentRole = updateData.role || user.role;

            if (currentRole === 'student' && schoolName !== undefined) {
                await tx.userAcademicProfile.upsert({
                    where: { userId: id },
                    create: {
                        userId: id,
                        schoolName
                    },
                    update: {
                        schoolName
                    }
                });
            }

            // Return updated user with relation data re-fetched to be sure
            return await tx.user.findUnique({
                where: { id },
                include: {
                    userInfo: true,
                    academicProfile: true
                }
            });
        }, {
            maxWait: 10000, // Wait up to 10s for a connection (default 2s)
            timeout: 20000  // Transaction timeout 20s (default 5s)
        });

        // Format for response (BigInt to string, flatten structure)
        const userResponse = {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            age: updatedUser.age,
            gender: updatedUser.gender,
            phone: updatedUser.phone ? updatedUser.phone.toString() : null,
            state: updatedUser.userInfo?.state || null,
            district: updatedUser.userInfo?.district || null,
            pincode: updatedUser.userInfo?.pincode || null,
            schoolName: updatedUser.academicProfile?.schoolName || null,
            profilepic: updatedUser.userInfo?.profilepic || null
        };

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get class-wise user stats for graph
const getClassWiseStats = async (req, res) => {
    try {
        const stats = {
            "Class 1–5": 0,
            "Class 6–8": 0,
            "Class 9–10": 0,
            "Class 11–12": 0,
            "Competitive Exams": 0
        };

        const profiles = await prisma.userAcademicProfile.findMany({
            select: {
                category: true
            }
        });

        profiles.forEach(p => {
            const category = p.category;
            if (category) {
                if (['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].includes(category)) {
                    stats["Class 1–5"]++;
                } else if (['Class 6', 'Class 7', 'Class 8'].includes(category)) {
                    stats["Class 6–8"]++;
                } else if (['Class 9', 'Class 10'].includes(category)) {
                    stats["Class 9–10"]++;
                } else if (['Class 11', 'Class 12'].includes(category)) {
                    stats["Class 11–12"]++;
                } else if (category === 'Aspirant') {
                    stats["Competitive Exams"]++;
                }
            }
        });

        // Format for frontend graph series
        // Categories: ["Class 1–5", "Class 6–8", "Class 9–10", "Class 11–12", "Competitive Exams"]
        const data = [
            stats["Class 1–5"],
            stats["Class 6–8"],
            stats["Class 9–10"],
            stats["Class 11–12"],
            stats["Competitive Exams"]
        ];

        res.json({ series: [{ name: "Users", data }] });

    } catch (error) {
        console.error("Error in getClassWiseStats:", error);
        res.status(500).json({ error: 'Error fetching class-wise stats', details: error.message });
    }
};

// Update active status (Heartbeat)
const updateActiveStatus = async (req, res) => {
    const { userId } = req.body;
    try {
        const parsedId = parseInt(userId);
        if (!userId || isNaN(parsedId)) {
            return res.status(400).json({ message: "Valid User ID required" });
        }

        const updatedUser = await prisma.user.update({
            where: { id: parsedId },
            data: { lastLogin: new Date() },
            select: { isActive: true }
        });

        if (!updatedUser.isActive) {
            return res.status(403).json({ message: "Account disabled", isActive: false });
        }

        res.json({ message: "Active status updated", isActive: true });
    } catch (error) {
        // console.error("Heartbeat error:", error); // Silence logs to avoid spam
        res.status(500).json({ message: "Error updating status" });
    }
};

// Toggle user account status (Enable/Disable)
const toggleAccountStatus = async (req, res) => {
    const { userId, isActive, reason } = req.body;

    try {
        if (!userId) return res.status(400).json({ message: "User ID required" });

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user) return res.status(404).json({ message: "User not found" });

        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { isActive: isActive }
        });

        // Send email if disabling
        if (isActive === false) {
            const nodemailer = require('nodemailer');
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });

                const emailText = `Dear ${user.name},\n\nYour account has been disabled by the administrator.\n\nReason: ${reason || 'No specific reason provided.'}\n\nIf you believe this is a mistake, please contact support.\n\nRegards,\nLMS Admin Team`;

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: "Account Status Notification - LMS Admin",
                    text: emailText,
                });
            } catch (emailError) {
                console.error('[DEBUG] Error sending email:', emailError);
            }
        }

        res.json({ message: `User ${isActive ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        console.error("Error toggling status:", error);
        res.status(500).json({ message: "Error updating status", error: error.message });
    }
};

const bcrypt = require('bcryptjs');

// Create Admin User
const createAdmin = async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        // Validation
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create Admin
        const newAdmin = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phone: BigInt(phone), // Ensure phone is stored as BigInt
                role: 'admin',
                isVerified: true,
                isActive: true
            }
        });

        // Convert BigInt to string for JSON response
        const adminResponse = {
            ...newAdmin,
            phone: newAdmin.phone.toString()
        };

        res.status(201).json({ message: 'Admin created successfully', user: adminResponse });

    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Upload Avatar - streams directly to S3 via multer-s3 middleware
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!req.body.userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // multer-s3 sets req.file.location to the public S3 URL
        const avatarUrl = req.file.location;

        // Save the S3 URL to the userInfo.profilepic column in NeonDB
        await prisma.userInfo.upsert({
            where: { userId: parseInt(req.body.userId) },
            create: {
                userId: parseInt(req.body.userId),
                profilepic: avatarUrl
            },
            update: {
                profilepic: avatarUrl
            }
        });

        res.json({
            message: 'Avatar uploaded successfully',
            url: avatarUrl
        });

    } catch (error) {
        console.error('[ERROR] Upload avatar error:', error);
        res.status(500).json({ message: 'Server error during upload', error: error.message });
    }
};

// Get monthly revenue stats for graph
const getMonthlyRevenueStats = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        const payments = await prisma.paymentDetail.findMany({
            where: {
                status: 'Success',
                date: {
                    gte: startOfYear,
                    lte: endOfYear
                }
            },
            select: {
                amount: true,
                date: true
            }
        });

        // Initialize 12 months with 0
        const monthlyRevenue = new Array(12).fill(0);

        payments.forEach(payment => {
            const month = new Date(payment.date).getMonth(); // 0-11
            monthlyRevenue[month] += payment.amount;
        });

        // Return data format expected by frontend series
        res.json({ series: [{ name: "Revenue", data: monthlyRevenue }] });

    } catch (error) {
        console.error("Error in getMonthlyRevenueStats:", error);
        res.status(500).json({ error: 'Error fetching revenue stats', details: error.message });
    }
};

module.exports = {
    getAllUsers,
    getUserStats,
    deleteUser,
    updateUserProfile,
    getClassWiseStats,
    getMonthlyRevenueStats,
    updateActiveStatus,
    toggleAccountStatus,
    createAdmin,
    uploadAvatar
};

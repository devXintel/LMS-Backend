const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/*  SIGNUP  */
/*  SIGNUP  */
exports.signup = async (req, res) => {
    const { email, password, name, age, gender, phone, category, schoolName, state, district, pincode } = req.body;

    try {
        let existingUser;
        // Retry logic for cold starts (3 attempts, 2s delay)
        for (let i = 0; i < 3; i++) {
            try {
                existingUser = await prisma.user.findUnique({
                    where: { email },
                });
                break; // Success, exit loop
            } catch (err) {
                console.log(`DB Connection attempt ${i + 1} failed: ${err.message}`);
                if (i === 2) throw err; // Throw on last attempt
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
            }
        }

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        const newUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    age: age ? parseInt(age) : null,
                    gender,
                    phone: phone ? BigInt(phone) : null,
                    role: (category && ['student', 'aspirant'].includes(category.toLowerCase())) ? category.toLowerCase() : 'user', // Map specific roles, else default to 'user'
                    isVerified: false,
                    userInfo: {
                        create: {
                            state,
                            district,
                            pincode: pincode ? parseInt(pincode) : null
                        }
                    },
                    // Only create academic profile if student and school name is provided
                    ...(category && category.toLowerCase() === 'student' && schoolName ? {
                        academicProfile: {
                            create: {
                                schoolName
                            }
                        }
                    } : {})
                },
            });

            await tx.token.create({
                data: {
                    userId: user.id,
                    otp,
                    otpExpires
                }
            });

            return user;
        }, {
            maxWait: 10000, // Wait up to 10s for a connection
            timeout: 15000  // Transaction timeout 15s (default 5s)
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'LMS Email Verification',
            text: `Your OTP is ${otp}`,
        });

        // Convert BigInt to string for JSON response
        const userForResponse = {
            ...newUser,
            phone: newUser.phone ? newUser.phone.toString() : null,
            isActive: newUser.isActive,
            isVerified: newUser.isVerified
        };

        res.status(201).json({
            message: 'OTP sent to email',
            userId: newUser.id,
            requiresOtp: true,
            user: userForResponse
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  VERIFY OTP  */
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                token: true,
                userInfo: true,
                academicProfile: true
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const tokenRecord = user.token;

        if (!tokenRecord || tokenRecord.otp !== otp || tokenRecord.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Treat undefined/null as true for backward compatibility
        if (user.isActive === false) {
            return res.status(403).json({
                message: 'Your account has been disabled. Please contact admin.'
            });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { email },
                data: { isVerified: true },
            }),
            prisma.token.update({
                where: { userId: user.id },
                data: { otp: null, otpExpires: null }
            })
        ]);

        // Update lastLogin for the user
        await prisma.user.update({
            where: { email },
            data: { lastLogin: new Date() }
        });

        // Check if user needs to complete basic info (age, gender, phone, etc.)
        const needsBasicInfo = !user.age || !user.gender || !user.phone;

        // Check if user needs to select category/class
        const needsCategorySelection = !user.academicProfile?.category && !user.academicProfile?.exam;

        // Return complete user object for auto-login
        res.json({
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                age: user.age,
                gender: user.gender,
                phone: user.phone ? user.phone.toString() : null,
                state: user.userInfo?.state || null,
                district: user.userInfo?.district || null,
                pincode: user.userInfo?.pincode || null,
                schoolName: user.academicProfile?.schoolName || null,
                classLevel: user.academicProfile?.category || null,
                board: user.academicProfile?.board || null,
                examType: user.academicProfile?.exam || null,
                medium: user.academicProfile?.medium || null,
                profilepic: user.userInfo?.profilepic || null,
                isActive: user.isActive,
                isVerified: user.isVerified
            },
            needsBasicInfo,
            needsCategorySelection
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  LOGIN  */
exports.login = async (req, res) => {
    const { email, password } = req.body;



    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                userInfo: true,
                academicProfile: true
            }
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }



        // Prevent Google-only accounts from using regular login
        if (!user.password || user.password === '') {
            return res.status(401).json({
                message: 'This account was created with Google. Please use "Continue with Google" to login.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password); // Fixed: Added await

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: 'Email not verified',
                requiresOtp: true
            });
        }



        // Treat undefined/null as true for backward compatibility
        if (user.isActive === false) {
            return res.status(403).json({
                message: 'Your account has been disabled. Please contact admin.'
            });
        }


        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        // Check if user needs to complete basic info (age, gender, phone, etc.)
        const needsBasicInfo = !user.age || !user.gender || !user.phone;

        // Check if user needs to select category/class
        const needsCategorySelection = !user.academicProfile?.category && !user.academicProfile?.exam;

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                age: user.age,
                gender: user.gender,
                phone: user.phone ? user.phone.toString() : null,
                state: user.userInfo?.state || null,
                district: user.userInfo?.district || null,
                pincode: user.userInfo?.pincode || null,
                schoolName: user.academicProfile?.schoolName || null,
                classLevel: user.academicProfile?.category || null,
                board: user.academicProfile?.board || null,
                examType: user.academicProfile?.exam || null,
                medium: user.academicProfile?.medium || null,
                profilepic: user.userInfo?.profilepic || null,
                isActive: user.isActive,
                isVerified: user.isVerified
            },
            needsBasicInfo,
            needsCategorySelection
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/*  CHECK EMAIL  */
exports.checkEmail = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            return res.json({ exists: true, message: 'User already exists' });
        }

        res.json({ exists: false, message: 'Email available' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

/*  UPDATE ROLE  */
exports.updateRole = async (req, res) => {
    const { email, role } = req.body;

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role },
        });

        const userForResponse = {
            ...user,
            phone: user.phone ? user.phone.toString() : null,
            isActive: user.isActive,
            isVerified: user.isVerified
        };

        res.json({ message: 'Role updated successfully', user: userForResponse });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  GOOGLE AUTH  */
exports.googleAuth = async (req, res) => {
    const { email, name } = req.body;

    try {
        let user = await prisma.user.findUnique({
            where: { email },
            include: {
                userInfo: true,
                academicProfile: true
            }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    role: 'student',
                    password: '',
                    isVerified: true,
                },
                include: {
                    userInfo: true,
                    academicProfile: true
                }
            });
        }

        if (!user.isVerified) {
            await prisma.user.update({
                where: { email },
                data: { isVerified: true }
            });
        }

        // Treat undefined/null as true for backward compatibility
        if (user.isActive === false) {
            return res.status(403).json({
                message: 'Your account has been disabled. Please contact admin.'
            });
        }

        // Update lastLogin for Google Auth to appear as Active
        await prisma.user.update({
            where: { email },
            data: { lastLogin: new Date() }
        });

        // Check if user needs to complete basic info (age, gender, phone, etc.)
        const needsBasicInfo = !user.age || !user.gender || !user.phone;

        // Check if user needs to select category/class
        const needsCategorySelection = !user.academicProfile?.category && !user.academicProfile?.exam;

        res.json({
            message: 'Google login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                age: user.age,
                gender: user.gender,
                phone: user.phone ? user.phone.toString() : null,
                state: user.userInfo?.state || null,
                district: user.userInfo?.district || null,
                pincode: user.userInfo?.pincode || null,
                schoolName: user.academicProfile?.schoolName || null,
                classLevel: user.academicProfile?.category || null,
                board: user.academicProfile?.board || null,
                examType: user.academicProfile?.exam || null,
                medium: user.academicProfile?.medium || null,
                profilepic: user.userInfo?.profilepic || null,
                isActive: user.isActive,
                isVerified: user.isVerified
            },
            needsBasicInfo,
            needsCategorySelection
        });

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  COMPLETE PROFILE  */
exports.completeProfile = async (req, res) => {
    const { email, age, address } = req.body;

    try {
        const user = await prisma.user.update({
            where: { email },
            data: {
                age: parseInt(age),
                address
            },
        });

        res.json({ message: 'Profile updated successfully', user });

    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  REQUEST PASSWORD RESET  */
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.token.upsert({
            where: { userId: user.id },
            update: { resetToken, resetTokenExpires },
            create: { userId: user.id, resetToken, resetTokenExpires }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Code',
            text: `Your password reset code is ${resetToken}. This code will expire in 10 minutes.`,
        });

        res.json({ message: 'Reset code sent to email' });

    } catch (error) {
        console.error('Request password reset error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  RESET PASSWORD  */
exports.resetPassword = async (req, res) => {
    const { email, resetToken, newPassword } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const tokenRecord = await prisma.token.findFirst({
            where: {
                userId: user.id,
                resetToken,
                resetTokenExpires: { gte: new Date() }
            }
        });

        if (!tokenRecord) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
        });

        await prisma.token.delete({
            where: { id: tokenRecord.id }
        });

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


/*  RESEND OTP  */
exports.resendOtp = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { token: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Upsert token (update if exists, create if not - though signup should have created it)
        await prisma.token.upsert({
            where: { userId: user.id },
            update: { otp, otpExpires },
            create: { userId: user.id, otp, otpExpires }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'LMS Email Verification (Resent)',
            text: `Your new OTP is ${otp}`,
        });

        res.json({ message: 'New OTP sent to email' });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  LOGOUT  */
exports.logout = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required for logout' });
    }

    try {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Even if user not found, returning success is safer for security/idempotency
            return res.json({ message: 'Logout successful' });
        }

        // Set lastLogin to 1 hour ago to ensure they are NOT counted as active (5 min window)
        const pastDate = new Date(Date.now() - 60 * 60 * 1000);

        await prisma.user.update({
            where: { email },
            data: { lastLogin: pastDate }
        });

        res.json({ message: 'Logout successful' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/*  VALIDATE USER  */
exports.validateUser = async (req, res) => {
    const { userId, email } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: email ? { email } : { id: userId },
            select: {
                id: true,
                email: true,
                isActive: true,
                isVerified: true
            }
        });

        if (!user) {
            return res.status(404).json({
                valid: false,
                message: 'User not found'
            });
        }

        // Check if user is active (treat null/undefined as true for backward compatibility)
        if (user.isActive === false) {
            return res.status(403).json({
                valid: false,
                message: 'Account has been disabled'
            });
        }

        res.json({
            valid: true,
            message: 'User is valid',
            user: {
                id: user.id,
                email: user.email,
                isActive: user.isActive,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('Validate user error:', error);
        res.status(500).json({
            valid: false,
            message: 'Server error',
            error: error.message
        });
    }
};

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/check-email', authController.checkEmail);
router.post('/update-role', authController.updateRole);
router.post('/google', authController.googleAuth);
router.post('/complete-profile', authController.completeProfile);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);
router.post('/validate', authController.validateUser);

module.exports = router;
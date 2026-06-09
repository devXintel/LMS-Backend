const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const upload = require('../middleware/upload');

router.get('/', userController.getAllUsers);
router.get('/stats', userController.getUserStats);
router.get('/stats/class-wise', userController.getClassWiseStats);
router.get('/stats/revenue', userController.getMonthlyRevenueStats);
router.post('/active', userController.updateActiveStatus);
router.post('/status', userController.toggleAccountStatus); // Toggle Enable/Disable
router.delete('/:id', userController.deleteUser);
router.post('/delete/:id', userController.deleteUser); // Alternative for reliable body transmission
router.post('/update-profile', userController.updateUserProfile);
router.post('/add-admin', userController.createAdmin);

// Avatar Upload Route
router.post('/upload-avatar', upload.single('avatar'), userController.uploadAvatar);

module.exports = router;

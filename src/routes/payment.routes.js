const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

router.get('/', paymentController.getAllPayments);
router.get('/analytics', paymentController.getRevenueAnalytics);
router.post('/seed', paymentController.seedPayments);

module.exports = router;

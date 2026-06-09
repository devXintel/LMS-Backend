const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');

router.get('/', subscriptionController.getAllPlans);
router.post('/', subscriptionController.createPlan);
router.put('/:id', subscriptionController.updatePlan);
router.delete('/:id', subscriptionController.deletePlan);

module.exports = router;

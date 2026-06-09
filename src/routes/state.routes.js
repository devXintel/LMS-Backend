const express = require('express');
const router = express.Router();
const stateController = require('../controllers/state.controller');

// Get all states
router.get('/', stateController.getAllStates);

// Get mediums by state ID
router.get('/:stateId/mediums', stateController.getMediumsByState);

// Create state
router.post('/', stateController.createState);

// Delete state
router.delete('/:id', stateController.deleteState);

module.exports = router;

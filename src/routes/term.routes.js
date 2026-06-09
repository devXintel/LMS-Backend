const express = require('express');
const router = express.Router();
const termController = require('../controllers/term.controller');

// Get all terms
router.get('/', termController.getAllTerms);

// Create term
router.post('/', termController.createTerm);

// Delete term
router.delete('/:id', termController.deleteTerm);

module.exports = router;

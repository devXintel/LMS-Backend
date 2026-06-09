const express = require('express');
const router = express.Router();
const boardController = require('../controllers/board.controller');

// Get all boards
router.get('/', boardController.getAllBoards);

// Create board
router.post('/', boardController.createBoard);

// Delete board
router.delete('/:id', boardController.deleteBoard);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
    getChildren,
    getNode,
    getFullTree,
    createNode,
    updateNode,
    deleteNode,
    markProgress,
} = require('../controllers/contentNode.controller');

// POST /api/content-nodes/progress
router.post('/progress', markProgress);

// GET /api/content-nodes/tree?rootType=SUBJECT
router.get('/tree', getFullTree);

// GET /api/content-nodes?parentId=<id>   (or without param for roots)
router.get('/', getChildren);

// GET /api/content-nodes/:id
router.get('/:id', getNode);

// POST /api/content-nodes
router.post('/', createNode);

// PATCH /api/content-nodes/:id
router.patch('/:id', updateNode);

// DELETE /api/content-nodes/:id  (soft-delete)
router.delete('/:id', deleteNode);

module.exports = router;

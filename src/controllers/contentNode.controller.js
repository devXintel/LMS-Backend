/**
 * contentNode.controller.js
 * ─────────────────────────
 * CRUD + tree-fetching for ContentNodes.
 * Replaces the old flat subject/chapter/subtopic queries.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * GET /api/content-nodes?parentId=<id>
 * Returns all direct children of a given parentId (or all roots if omitted).
 */
const getChildren = async (req, res) => {
    try {
        const parentId = req.query.parentId ? parseInt(req.query.parentId) : null;
        const nodes = await prisma.contentNode.findMany({
            where: { parentId, isActive: true },
            orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
            select: {
                id: true,
                name: true,
                slug: true,
                type: true,
                parentId: true,
                orderIndex: true,
                metadata: true,
                _count: { select: { children: true } },
            },
        });
        res.json(nodes);
    } catch (err) {
        console.error('[ContentNode] getChildren error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/content-nodes/:id
 * Returns a single node with its children.
 */
const getNode = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const node = await prisma.contentNode.findUnique({
            where: { id },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
                },
            },
        });
        if (!node) return res.status(404).json({ error: 'Node not found' });
        res.json(node);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/content-nodes/tree?rootType=SUBJECT
 * Returns a full tree starting from all nodes of the given type (default SUBJECT).
 * Uses recursive CTE via raw SQL for efficiency.
 */
const getFullTree = async (req, res) => {
    try {
        const rootType = req.query.rootType || 'SUBJECT';

        // Fetch roots
        const roots = await prisma.contentNode.findMany({
            where: { type: rootType, isActive: true, parentId: null },
            orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        });

        // Recursively attach children (in JS — depth is small for syllabus trees)
        async function attachChildren(node) {
            const children = await prisma.contentNode.findMany({
                where: { parentId: node.id, isActive: true },
                orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
            });
            node.children = await Promise.all(children.map(attachChildren));
            return node;
        }

        const tree = await Promise.all(roots.map(attachChildren));
        res.json(tree);
    } catch (err) {
        console.error('[ContentNode] getFullTree error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/content-nodes
 * Create a new node.
 */
const createNode = async (req, res) => {
    try {
        const { name, slug, type, parentId, metadata, orderIndex } = req.body;
        if (!name || !slug || !type) {
            return res.status(400).json({ error: 'name, slug, and type are required.' });
        }
        const node = await prisma.contentNode.create({
            data: {
                name, slug, type,
                parentId:   parentId  ?? null,
                metadata:   metadata  ?? {},
                orderIndex: orderIndex ?? 0,
            },
        });
        res.status(201).json(node);
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'A node with this slug already exists under the same parent.' });
        }
        res.status(500).json({ error: err.message });
    }
};

/**
 * PATCH /api/content-nodes/:id
 * Update a node's metadata / name / orderIndex / isActive.
 */
const updateNode = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, metadata, orderIndex, isActive } = req.body;
        const node = await prisma.contentNode.update({
            where: { id },
            data: {
                ...(name        !== undefined && { name }),
                ...(metadata    !== undefined && { metadata }),
                ...(orderIndex  !== undefined && { orderIndex }),
                ...(isActive    !== undefined && { isActive }),
            },
        });
        res.json(node);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Node not found' });
        res.status(500).json({ error: err.message });
    }
};

/**
 * DELETE /api/content-nodes/:id
 * Soft-delete (isActive = false). Cascade handled by DB on hard delete.
 */
const deleteNode = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.contentNode.update({ where: { id }, data: { isActive: false } });
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Node not found' });
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/content-nodes/progress
 * Mark a node as completed for the current user.
 */
const markProgress = async (req, res) => {
    try {
        let { userId, contentNodeId, isCompleted } = req.body;

        const uId = parseInt(userId);
        const cnId = parseInt(contentNodeId);

        if (isNaN(uId) || isNaN(cnId)) {
            console.warn('[ContentNode] markProgress: Invalid IDs received:', { userId, contentNodeId });
            return res.status(400).json({ error: 'Valid userId and contentNodeId are required.' });
        }

        // Verify Node Exists
        const nodeExists = await prisma.contentNode.findUnique({ where: { id: cnId } });
        if (!nodeExists) {
            console.warn('[ContentNode] markProgress: Node not found:', cnId);
            return res.status(404).json({ error: 'Content node not found.' });
        }

        // Verify User Exists
        const userExists = await prisma.user.findUnique({ where: { id: uId } });
        if (!userExists) {
            console.warn('[ContentNode] markProgress: User not found:', uId);
            return res.status(404).json({ error: 'User not found.' });
        }

        console.log(`[ContentNode] Marking progress: user=${uId} node=${cnId} completed=${isCompleted ?? true}`);

        const progress = await prisma.lessonProgress.upsert({
            where: { userId_contentNodeId: { userId: uId, contentNodeId: cnId } },
            update: { isCompleted: isCompleted ?? true },
            create: { userId: uId, contentNodeId: cnId, isCompleted: isCompleted ?? true },
        });

        res.json(progress);
    } catch (err) {
        // Distinguish DB-unreachable from other errors so the UI can handle gracefully
        const isDbDown = err.message?.includes("Can't reach database") ||
                         err.message?.includes("connection") ||
                         err.code === 'P1001' || err.code === 'P1008' || err.code === 'P1017';
        if (isDbDown) {
            console.warn('[ContentNode] markProgress: DB unreachable — progress NOT saved:', err.message);
            return res.status(503).json({ error: 'Database temporarily unavailable. Progress not saved.', retryable: true });
        }
        console.error('[ContentNode] markProgress error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

module.exports = { getChildren, getNode, getFullTree, createNode, updateNode, deleteNode, markProgress };

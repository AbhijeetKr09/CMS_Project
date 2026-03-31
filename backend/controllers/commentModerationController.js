import prisma from '../prismaClient.js';

// ─── EDITOR: List ALL comments across all articles (paginated) ────────────────
export const listAllComments = async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 30);
    const search = req.query.search?.trim() || '';

    try {
        const where = search
            ? { text: { contains: search, mode: 'insensitive' } }
            : {};

        const [comments, total] = await Promise.all([
            prisma.comment.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip:  (page - 1) * limit,
                take:  limit,
                include: {
                    user:    { select: { id: true, name: true, email: true, profileImage: true } },
                    article: { select: { id: true, title: true } },
                },
            }),
            prisma.comment.count({ where }),
        ]);

        res.json({
            comments,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error('[Comments] listAllComments:', err);
        res.status(500).json({ message: 'Failed to fetch comments.' });
    }
};

// ─── EDITOR: List comments for a specific article ─────────────────────────────
export const listComments = async (req, res) => {
    const { articleId } = req.params;
    try {
        const comments = await prisma.comment.findMany({
            where: { articleId },
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true, profileImage: true } },
            },
        });
        res.json(comments);
    } catch (err) {
        console.error('[Comments] listComments:', err);
        res.status(500).json({ message: 'Failed to fetch comments.' });
    }
};

// ─── EDITOR: Delete a comment (moderation) ───────────────────────────────────
export const deleteComment = async (req, res) => {
    const { id } = req.params;
    try {
        const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });
        if (!comment) return res.status(404).json({ message: 'Comment not found.' });

        await prisma.comment.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Comment removed.' });
    } catch (err) {
        console.error('[Comments] deleteComment:', err);
        res.status(500).json({ message: 'Failed to delete comment.' });
    }
};

import prisma from '../prismaClient.js';

// Helper: build sub-model create payloads from request body
const buildSubRelations = (body) => ({
    images:      (body.images      || []).map(({ src, alt, caption }) => ({ src, alt: alt || '', caption: caption || '' })),
    keyInsights: (body.keyInsights || []).map(({ insightText }) => ({ insightText })),
});

// Extract up to 4 related article IDs from request body
const extractRelatedIds = (body) => ({
    relatedArticle1Id: body.relatedArticle1Id || null,
    relatedArticle2Id: body.relatedArticle2Id || null,
    relatedArticle3Id: body.relatedArticle3Id || null,
    relatedArticle4Id: body.relatedArticle4Id || null,
});

// Helper: include clause for full staged article with relations
const FULL_INCLUDE = {
    submittedBy:  { select: { id: true, name: true, email: true } },
    reviewedBy:   { select: { id: true, name: true, email: true } },
    assignedTo:   { select: { id: true, name: true, email: true } },
    images:       true,
    keyInsights:  true,
    relatedArticle1: { select: { id: true, title: true, mainImage: true } },
    relatedArticle2: { select: { id: true, title: true, mainImage: true } },
    relatedArticle3: { select: { id: true, title: true, mainImage: true } },
    relatedArticle4: { select: { id: true, title: true, mainImage: true } },
};

// ─── JOURNALIST: Create new draft ───────────────────────────────────────────
export const createDraft = async (req, res) => {
    try {
        const { images, keyInsights } = buildSubRelations(req.body);
        const relatedIds = extractRelatedIds(req.body);
        const draft = await prisma.stagedArticle.create({
            data: {
                submittedById:   req.cmsUser.id,
                title:           req.body.title           || '',
                body:            req.body.body,
                shortDescription:req.body.shortDescription,
                mainImage:       req.body.mainImage,
                readTime:        req.body.readTime,
                tags:            req.body.tags            || [],
                type:            req.body.type,
                ...relatedIds,
                images:      { create: images },
                keyInsights: { create: keyInsights },
            },
            include: FULL_INCLUDE,
        });
        res.status(201).json(draft);
    } catch (err) {
        console.error('[StagedArticle] createDraft:', err);
        res.status(500).json({ message: 'Failed to create draft.' });
    }
};

// ─── JOURNALIST: Save / update a draft or NEEDS_CHANGES article ─────────────
export const updateDraft = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await prisma.stagedArticle.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Article not found.' });
        const canEdit = existing.submittedById === req.cmsUser.id || existing.assignedToId === req.cmsUser.id;
        if (!canEdit)
            return res.status(403).json({ message: 'Not your article.' });
        if (!['DRAFT', 'NEEDS_CHANGES'].includes(existing.status))
            return res.status(400).json({ message: `Cannot edit article with status: ${existing.status}` });

        const { images, keyInsights } = buildSubRelations(req.body);
        const relatedIds = extractRelatedIds(req.body);

        // Replace sub-relation rows: delete all existing then re-create
        await prisma.$transaction([
            prisma.stagedArticleImage.deleteMany({ where: { stagedArticleId: id } }),
            prisma.stagedArticleKeyInsight.deleteMany({ where: { stagedArticleId: id } }),
        ]);

        const updated = await prisma.stagedArticle.update({
            where: { id },
            data: {
                title:            req.body.title            ?? existing.title,
                body:             req.body.body             ?? existing.body,
                shortDescription: req.body.shortDescription ?? existing.shortDescription,
                mainImage:        req.body.mainImage        ?? existing.mainImage,
                readTime:         req.body.readTime         ?? existing.readTime,
                tags:             req.body.tags             ?? existing.tags,
                type:             req.body.type             ?? existing.type,
                ...relatedIds,
                images:      { create: images },
                keyInsights: { create: keyInsights },
            },
            include: FULL_INCLUDE,
        });
        res.json(updated);
    } catch (err) {
        console.error('[StagedArticle] updateDraft:', err);
        res.status(500).json({ message: 'Failed to save draft.' });
    }
};

// ─── JOURNALIST: Submit for review ──────────────────────────────────────────
export const submitForReview = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await prisma.stagedArticle.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Article not found.' });
        const canSubmit = existing.submittedById === req.cmsUser.id || existing.assignedToId === req.cmsUser.id;
        if (!canSubmit)
            return res.status(403).json({ message: 'Not your article.' });
        if (!['DRAFT', 'NEEDS_CHANGES'].includes(existing.status))
            return res.status(400).json({ message: `Cannot submit article with status: ${existing.status}` });

        const updated = await prisma.stagedArticle.update({
            where: { id },
            data: { status: 'SUBMITTED', submittedAt: new Date(), editorNote: null },
            include: FULL_INCLUDE,
        });
        res.json(updated);
    } catch (err) {
        console.error('[StagedArticle] submitForReview:', err);
        res.status(500).json({ message: 'Failed to submit article.' });
    }
};

// ─── JOURNALIST: List my articles ───────────────────────────────────────────
export const listMine = async (req, res) => {
    try {
        const articles = await prisma.stagedArticle.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { submittedById: req.cmsUser.id },
                            { assignedToId: req.cmsUser.id },
                        ],
                    },
                    // Exclude PUBLISHED — they are immutable history, not actionable.
                    // Also prevents ghost records from appearing after the live article is deleted.
                    { status: { not: 'PUBLISHED' } },
                ],
            },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true, title: true, status: true, editorNote: true,
                createdAt: true, updatedAt: true, submittedAt: true,
                tags: true, type: true, mainImage: true, assignedToId: true,
                assignedAt: true, recalledFromId: true,
                relatedArticle1Id: true, relatedArticle2Id: true,
                relatedArticle3Id: true, relatedArticle4Id: true,
                submittedBy: { select: { id: true, name: true } },
                assignedTo:  { select: { id: true, name: true } },
                _count: { select: { images: true, keyInsights: true } },
            },
        });
        res.json(articles);
    } catch (err) {
        console.error('[StagedArticle] listMine:', err);
        res.status(500).json({ message: 'Failed to fetch articles.' });
    }
};

// ─── EDITOR: List all submissions (SUBMITTED + NEEDS_CHANGES) ───────────────
export const listSubmissions = async (req, res) => {
    try {
        const articles = await prisma.stagedArticle.findMany({
            where: { status: { in: ['SUBMITTED', 'NEEDS_CHANGES'] } },
            orderBy: { submittedAt: 'asc' },
            include: {
                submittedBy: { select: { id: true, name: true, email: true } },
                _count: { select: { images: true, keyInsights: true } },
            },
        });
        res.json(articles);
    } catch (err) {
        console.error('[StagedArticle] listSubmissions:', err);
        res.status(500).json({ message: 'Failed to fetch submissions.' });
    }
};

// ─── JOURNALIST or EDITOR: Get single article (full) ────────────────────────
export const getById = async (req, res) => {
    const { id } = req.params;
    try {
        const article = await prisma.stagedArticle.findUnique({
            where: { id },
            include: FULL_INCLUDE,
        });
        if (!article) return res.status(404).json({ message: 'Article not found.' });

        // Journalist can only see their own OR articles assigned to them
        if (req.cmsUser.role === 'JOURNALIST') {
            const isOwner   = article.submittedById === req.cmsUser.id;
            const isAssigned = article.assignedToId  === req.cmsUser.id;
            if (!isOwner && !isAssigned)
                return res.status(403).json({ message: 'Access denied.' });
        }

        if (article.body && article.images) {
            let imgIndex = 0;
            article.body = article.body.replace(/\[IMAGE\]/g, () => {
                const img = article.images[imgIndex++];
                if (img) {
                    const src = img.src;
                    const alt = img.alt || 'image';
                    return `![${alt}](${src})`;
                }
                return '[IMAGE]';
            });
        }

        res.json(article);
    } catch (err) {
        console.error('[StagedArticle] getById:', err);
        res.status(500).json({ message: 'Failed to fetch article.' });
    }
};

// ─── EDITOR: Add a note to journalist (no status change) ────────────────────
export const addNote = async (req, res) => {
    const { id } = req.params;
    const { note } = req.body;

    if (!note?.trim())
        return res.status(400).json({ message: 'note is required.' });

    try {
        const existing = await prisma.stagedArticle.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Article not found.' });

        const updated = await prisma.stagedArticle.update({
            where: { id },
            data: { editorNote: note.trim(), reviewedById: req.cmsUser.id },
            include: FULL_INCLUDE,
        });
        res.json(updated);
    } catch (err) {
        console.error('[StagedArticle] addNote:', err);
        res.status(500).json({ message: 'Failed to save note.' });
    }
};

// ─── EDITOR: Request changes ────────────────────────────────────────────────
export const requestChanges = async (req, res) => {
    const { id } = req.params;
    const { editorNote } = req.body;

    if (!editorNote?.trim())
        return res.status(400).json({ message: 'editorNote is required when requesting changes.' });

    try {
        const existing = await prisma.stagedArticle.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Article not found.' });
        if (existing.status !== 'SUBMITTED')
            return res.status(400).json({ message: 'Can only request changes on SUBMITTED articles.' });

        const updated = await prisma.stagedArticle.update({
            where: { id },
            data: {
                status:       'NEEDS_CHANGES',
                editorNote:   editorNote.trim(),
                reviewedById: req.cmsUser.id,
                reviewedAt:   new Date(),
            },
            include: FULL_INCLUDE,
        });
        res.json(updated);
    } catch (err) {
        console.error('[StagedArticle] requestChanges:', err);
        res.status(500).json({ message: 'Failed to request changes.' });
    }
};

// ─── EDITOR: Publish — copy full staged article to main articles table ───────
export const publish = async (req, res) => {
    const { id } = req.params;
    try {
        // Load staged article with all sub-relations
        const staged = await prisma.stagedArticle.findUnique({
            where: { id },
            include: { images: true, keyInsights: true, relatedNews: true },
        });
        if (!staged)  return res.status(404).json({ message: 'Article not found.' });
        if (staged.status !== 'SUBMITTED')
            return res.status(400).json({ message: 'Can only publish SUBMITTED articles.' });

        // ── Compute next sequential article-N id (mirrors getNextArticleId logic) ──
        const allIds = await prisma.article.findMany({ select: { id: true } });
        let maxNum = 0;
        allIds.forEach(a => {
            const m = a.id.match(/^article-(\d+)$/i);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });
        const nextArticleId = `article-${maxNum + 1}`;

        // Atomic transaction: create live article (with all sub-rows) + mark staged as PUBLISHED
        const publishedArticle = await prisma.$transaction(async (tx) => {

            // Normalise the body: replace any inline image syntax with [IMAGE] placeholders,
            // exactly as articleController.createArticle / updateArticle does.
            let publishBody = staged.body || '';
            publishBody = publishBody.replace(/\{\{IMG_(\d+)\}\}/g, () => '[IMAGE]');
            publishBody = publishBody.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, () => '[IMAGE]');
            // Also strip bare HTML <img> tags that may appear if TipTap serialised as HTML
            publishBody = publishBody.replace(/<img[^>]+>/gi, '[IMAGE]');

            const article = await tx.article.create({
                data: {
                    id:               nextArticleId,
                    title:            staged.title,
                    timestampDate:    new Date(),
                    body:             publishBody,
                    shortDescription: staged.shortDescription,
                    mainImage:        staged.mainImage,
                    readTime:         staged.readTime,
                    tags:             staged.tags,
                    type:             staged.type,
                    // Copy sub-relations
                    images: {
                        create: staged.images.map(({ src, alt, caption }) => ({ src, alt, caption })),
                    },
                    keyInsights: {
                        create: staged.keyInsights.map(({ insightText }) => ({ insightText })),
                    },
                },
            });

            // Create ArticleRelatedNews rows for each non-null related article ID
            const relatedIds = [
                staged.relatedArticle1Id,
                staged.relatedArticle2Id,
                staged.relatedArticle3Id,
                staged.relatedArticle4Id,
            ].filter(Boolean);

            for (const relatedArticleId of relatedIds) {
                // Verify the related article exists to avoid FK violations
                const exists = await tx.article.findUnique({ where: { id: relatedArticleId }, select: { id: true } });
                if (exists) {
                    await tx.articleRelatedNews.create({
                        data: {
                            articleId:        article.id,
                            relatedArticleId: relatedArticleId,
                        },
                    });
                }
            }

            await tx.stagedArticle.update({
                where: { id },
                data: {
                    status:            'PUBLISHED',
                    publishedArticleId: article.id,
                    reviewedById:      req.cmsUser.id,
                    reviewedAt:        new Date(),
                    editorNote:        null,
                },
            });

            return article;
        });

        res.json({
            message:           'Article published successfully.',
            publishedArticleId: publishedArticle.id,
            stagedArticleId:   id,
        });
    } catch (err) {
        console.error('[StagedArticle] publish:', err);
        res.status(500).json({ message: 'Failed to publish article.' });
    }
};

// ─── EDITOR: List all journalists (for assignment dropdown) ──────────────────
export const listJournalists = async (req, res) => {
    try {
        const journalists = await prisma.cmsUser.findMany({
            where: { role: { in: ['JOURNALIST', 'ADMIN'] } },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: 'asc' },
        });
        res.json(journalists);
    } catch (err) {
        console.error('[StagedArticle] listJournalists:', err);
        res.status(500).json({ message: 'Failed to fetch journalists.' });
    }
};

// ─── EDITOR: Recall a published article back to staging ─────────────────────
export const recall = async (req, res) => {
    const { articleId } = req.params;
    const { assignedToId, editorNote } = req.body;

    if (!assignedToId)
        return res.status(400).json({ message: 'assignedToId is required.' });

    try {
        const journalist = await prisma.cmsUser.findUnique({ where: { id: assignedToId } });
        if (!journalist) return res.status(404).json({ message: 'Journalist not found.' });

        const live = await prisma.article.findUnique({
            where: { id: articleId },
            include: { images: true, keyInsights: true, relatedNews: true },
        });
        if (!live) return res.status(404).json({ message: 'Published article not found.' });

        // Step 1: Create the staged article (outside transaction to avoid timeout)
        const staged = await prisma.stagedArticle.create({
            data: {
                title:            live.title,
                body:             live.body,
                shortDescription: live.shortDescription,
                mainImage:        live.mainImage,
                readTime:         live.readTime,
                tags:             { set: live.tags },
                type:             live.type,
                status:           'NEEDS_CHANGES',
                editorNote:       editorNote?.trim() || 'This article has been recalled for updates.',
                submittedById:    req.cmsUser.id,
                assignedToId,
                assignedAt:       new Date(),
                recalledFromId:   live.id,
                images:      { create: live.images.map(({ src, alt, caption }) => ({ src, alt: alt ?? '', caption: caption ?? '' })) },
                keyInsights: { create: live.keyInsights.map(({ insightText }) => ({ insightText })) },
                // Map existing ArticleRelatedNews back to the flat relatedArticle1–4 IDs
                relatedArticle1Id: live.relatedNews[0]?.relatedArticleId ?? null,
                relatedArticle2Id: live.relatedNews[1]?.relatedArticleId ?? null,
                relatedArticle3Id: live.relatedNews[2]?.relatedArticleId ?? null,
                relatedArticle4Id: live.relatedNews[3]?.relatedArticleId ?? null,
            },
        });

        // Step 2: Remove the obsolete PUBLISHED staged record(s) that pointed to this
        // live article — prevents the article appearing twice in the journalist's list
        // (once as PUBLISHED ghost, once as the new NEEDS_CHANGES recall entry).
        await prisma.stagedArticle.deleteMany({ where: { publishedArticleId: articleId } });

        // Step 3: Delete the live article (cascade handles children)
        await prisma.article.delete({ where: { id: articleId } });

        res.status(201).json({
            message: `Article recalled and assigned to ${journalist.name}.`,
            staged: { id: staged.id, title: staged.title, assignedToId: staged.assignedToId },
        });
    } catch (err) {
        console.error('[StagedArticle] recall ERROR:', err?.message, err?.code, err?.meta);
        res.status(500).json({ message: err?.message || 'Failed to recall article.' });
    }
};

// ─── EDITOR: Permanently delete a published article ──────────────────────────
export const deleteArticle = async (req, res) => {
    const { articleId } = req.params;
    try {
        const article = await prisma.article.findUnique({ where: { id: articleId } });
        if (!article) return res.status(404).json({ message: 'Article not found.' });

        // Cascade handles children (ArticleImage, Comment, etc. all have onDelete: Cascade)
        await prisma.article.delete({ where: { id: articleId } });

        res.json({ message: 'Article permanently deleted.' });
    } catch (err) {
        console.error('[StagedArticle] deleteArticle ERROR:', err?.message, err?.code, err?.meta);
        res.status(500).json({ message: err?.message || 'Failed to delete article.' });
    }
};


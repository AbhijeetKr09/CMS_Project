import prisma from '../prismaClient.js';

const VALID_PLATFORMS = ['linkedin', 'twitter', 'youtube'];

// ─── LIST all trends ─────────────────────────────────────────────────────────
export const listTrends = async (req, res) => {
    const { platform, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (platform) {
        if (!VALID_PLATFORMS.includes(platform))
            return res.status(400).json({ message: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` });
        where.platform = platform;
    }

    try {
        const [trends, total] = await Promise.all([
            prisma.socialTrend.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.socialTrend.count({ where }),
        ]);
        res.json({ trends, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('[SocialTrend] listTrends:', err);
        res.status(500).json({ message: 'Failed to fetch social trends.' });
    }
};

// ─── CREATE trend ────────────────────────────────────────────────────────────
export const createTrend = async (req, res) => {
    const { platform, content, url, imageUrl, author, authorImage, date, likes, comments, shares, isActive } = req.body;

    if (!platform || !url)
        return res.status(400).json({ message: 'platform and url are required.' });
    if (!VALID_PLATFORMS.includes(platform))
        return res.status(400).json({ message: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` });

    try {
        const trend = await prisma.socialTrend.create({
            data: {
                platform, content, url,
                imageUrl, author, authorImage,
                date: date ? new Date(date) : new Date(),
                likes, comments, shares,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
            },
        });
        res.status(201).json(trend);
    } catch (err) {
        console.error('[SocialTrend] createTrend:', err);
        res.status(500).json({ message: 'Failed to create trend.' });
    }
};

// ─── UPDATE trend ────────────────────────────────────────────────────────────
export const updateTrend = async (req, res) => {
    const { id } = req.params;
    const { platform, content, url, imageUrl, author, authorImage, date, likes, comments, shares, isActive } = req.body;

    if (platform && !VALID_PLATFORMS.includes(platform))
        return res.status(400).json({ message: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` });

    try {
        const existing = await prisma.socialTrend.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Trend not found.' });

        const trend = await prisma.socialTrend.update({
            where: { id },
            data: {
                ...(platform    !== undefined && { platform }),
                ...(content     !== undefined && { content }),
                ...(url         !== undefined && { url }),
                ...(imageUrl    !== undefined && { imageUrl }),
                ...(author      !== undefined && { author }),
                ...(authorImage !== undefined && { authorImage }),
                ...(date        !== undefined && { date: new Date(date) }),
                ...(likes       !== undefined && { likes }),
                ...(comments    !== undefined && { comments }),
                ...(shares      !== undefined && { shares }),
                ...(isActive    !== undefined && { isActive: Boolean(isActive) }),
            },
        });
        res.json(trend);
    } catch (err) {
        console.error('[SocialTrend] updateTrend:', err);
        res.status(500).json({ message: 'Failed to update trend.' });
    }
};

// ─── DELETE trend ────────────────────────────────────────────────────────────
export const deleteTrend = async (req, res) => {
    try {
        const existing = await prisma.socialTrend.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Trend not found.' });
        await prisma.socialTrend.delete({ where: { id: req.params.id } });
        res.json({ message: 'Trend deleted.' });
    } catch (err) {
        console.error('[SocialTrend] deleteTrend:', err);
        res.status(500).json({ message: 'Failed to delete trend.' });
    }
};

// ─── TOGGLE isActive ─────────────────────────────────────────────────────────
export const toggleTrend = async (req, res) => {
    try {
        const existing = await prisma.socialTrend.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Trend not found.' });
        const trend = await prisma.socialTrend.update({
            where: { id: req.params.id },
            data: { isActive: !existing.isActive },
        });
        res.json(trend);
    } catch (err) {
        console.error('[SocialTrend] toggleTrend:', err);
        res.status(500).json({ message: 'Failed to toggle trend.' });
    }
};

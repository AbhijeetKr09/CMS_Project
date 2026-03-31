import prisma from '../prismaClient.js';

const S3_PUBLIC = `https://${process.env.S3_PUBLIC_DATA}.s3.${process.env.AWS_REGION}.amazonaws.com/`;

const buildUrl = (key) => {
    if (!key) return null;
    if (key.startsWith('http')) return key;
    return `${S3_PUBLIC}${key}`;
};

// ─── LIST media ──────────────────────────────────────────────────────────────
export const listMedia = async (req, res) => {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = type ? { type } : {};

    try {
        const [media, total] = await Promise.all([
            prisma.media.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.media.count({ where }),
        ]);
        res.json({
            media: media.map(m => ({
                ...m,
                urlFull:       buildUrl(m.url),
                thumbnailFull: buildUrl(m.thumbnail),
            })),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        console.error('[MediaCms] listMedia:', err);
        res.status(500).json({ message: 'Failed to fetch media.' });
    }
};

// ─── CREATE media record ─────────────────────────────────────────────────────
export const createMedia = async (req, res) => {
    const { type, title, description, url, thumbnail, tags = [], date } = req.body;
    if (!type || !title)
        return res.status(400).json({ message: 'type and title are required.' });

    try {
        const media = await prisma.media.create({
            data: {
                type, title,
                description: description || null,
                url:         url         || null,
                thumbnail:   thumbnail   || null,
                tags,
                date: date ? new Date(date) : new Date(),
                views: 0, downloads: 0,
            },
        });
        res.status(201).json(media);
    } catch (err) {
        console.error('[MediaCms] createMedia:', err);
        res.status(500).json({ message: 'Failed to create media record.' });
    }
};

// ─── UPDATE media ────────────────────────────────────────────────────────────
export const updateMedia = async (req, res) => {
    const { id } = req.params;
    const { title, description, url, thumbnail, tags, date } = req.body;

    try {
        const existing = await prisma.media.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Media not found.' });

        const media = await prisma.media.update({
            where: { id },
            data: {
                ...(title       !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(url         !== undefined && { url }),
                ...(thumbnail   !== undefined && { thumbnail }),
                ...(tags        !== undefined && { tags }),
                ...(date        !== undefined && { date: new Date(date) }),
            },
        });
        res.json(media);
    } catch (err) {
        console.error('[MediaCms] updateMedia:', err);
        res.status(500).json({ message: 'Failed to update media.' });
    }
};

// ─── DELETE media ────────────────────────────────────────────────────────────
export const deleteMedia = async (req, res) => {
    try {
        const existing = await prisma.media.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Media not found.' });
        await prisma.media.delete({ where: { id: req.params.id } });
        res.json({ message: 'Media deleted.' });
    } catch (err) {
        console.error('[MediaCms] deleteMedia:', err);
        res.status(500).json({ message: 'Failed to delete media.' });
    }
};

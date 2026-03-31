import prisma from '../prismaClient.js';

const S3_PUBLIC = `https://${process.env.S3_PUBLIC_DATA}.s3.${process.env.AWS_REGION}.amazonaws.com/`;

const buildImageUrl = (key) => {
    if (!key) return null;
    if (key.startsWith('http')) return key;
    return `${S3_PUBLIC}${key}`;
};

// ─── LIST all experts ────────────────────────────────────────────────────────
export const listExperts = async (req, res) => {
    try {
        const experts = await prisma.expert.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(experts.map(e => ({ ...e, imageUrl: buildImageUrl(e.image) })));
    } catch (err) {
        console.error('[ExpertCms] listExperts:', err);
        res.status(500).json({ message: 'Failed to fetch experts.' });
    }
};

// ─── GET single expert ───────────────────────────────────────────────────────
export const getExpert = async (req, res) => {
    try {
        const expert = await prisma.expert.findUnique({ where: { id: req.params.id } });
        if (!expert) return res.status(404).json({ message: 'Expert not found.' });
        res.json({ ...expert, imageUrl: buildImageUrl(expert.image) });
    } catch (err) {
        console.error('[ExpertCms] getExpert:', err);
        res.status(500).json({ message: 'Failed to fetch expert.' });
    }
};

// ─── CREATE expert ───────────────────────────────────────────────────────────
export const createExpert = async (req, res) => {
    const { name, role, company, image, quote, highlight, url, isActive } = req.body;
    if (!name || !role || !company || !quote)
        return res.status(400).json({ message: 'name, role, company, and quote are required.' });

    try {
        const expert = await prisma.expert.create({
            data: {
                name, role, company,
                image: image || null,
                quote,
                highlight: highlight || null,
                url: url || null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
            },
        });
        res.status(201).json({ ...expert, imageUrl: buildImageUrl(expert.image) });
    } catch (err) {
        console.error('[ExpertCms] createExpert:', err);
        res.status(500).json({ message: 'Failed to create expert.' });
    }
};

// ─── UPDATE expert ───────────────────────────────────────────────────────────
export const updateExpert = async (req, res) => {
    const { id } = req.params;
    const { name, role, company, image, quote, highlight, url, isActive } = req.body;

    try {
        const existing = await prisma.expert.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Expert not found.' });

        const expert = await prisma.expert.update({
            where: { id },
            data: {
                ...(name      !== undefined && { name }),
                ...(role      !== undefined && { role }),
                ...(company   !== undefined && { company }),
                ...(image     !== undefined && { image }),
                ...(quote     !== undefined && { quote }),
                ...(highlight !== undefined && { highlight }),
                ...(url       !== undefined && { url }),
                ...(isActive  !== undefined && { isActive: Boolean(isActive) }),
            },
        });
        res.json({ ...expert, imageUrl: buildImageUrl(expert.image) });
    } catch (err) {
        console.error('[ExpertCms] updateExpert:', err);
        res.status(500).json({ message: 'Failed to update expert.' });
    }
};

// ─── DELETE expert ───────────────────────────────────────────────────────────
export const deleteExpert = async (req, res) => {
    try {
        const existing = await prisma.expert.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Expert not found.' });
        await prisma.expert.delete({ where: { id: req.params.id } });
        res.json({ message: 'Expert deleted.' });
    } catch (err) {
        console.error('[ExpertCms] deleteExpert:', err);
        res.status(500).json({ message: 'Failed to delete expert.' });
    }
};

// ─── TOGGLE isActive ─────────────────────────────────────────────────────────
export const toggleExpert = async (req, res) => {
    try {
        const existing = await prisma.expert.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Expert not found.' });
        const expert = await prisma.expert.update({
            where: { id: req.params.id },
            data: { isActive: !existing.isActive },
        });
        res.json({ ...expert, imageUrl: buildImageUrl(expert.image) });
    } catch (err) {
        console.error('[ExpertCms] toggleExpert:', err);
        res.status(500).json({ message: 'Failed to toggle expert.' });
    }
};

import prisma from '../prismaClient.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const PRIVATE_BUCKET = process.env.S3_BUCKET_NAME;

const signedUrl = async (key) => {
    if (!key) return null;
    try {
        const cmd = new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key });
        return await getSignedUrl(s3, cmd, { expiresIn: 7200 });
    } catch { return null; }
};

// Auto-generate slug from first 4 words of title
const makeSlug = (title) =>
    title
        .split(/\s+/)
        .slice(0, 4)
        .join('-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .replace(/-+/g, '-');

// ─── LIST all analytical articles ───────────────────────────────────────────
export const listAnalytical = async (req, res) => {
    try {
        const articles = await prisma.analyticalArticle.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, title: true, shortDescription: true,
                tags: true, readTime: true, mainImage: true,
                createdAt: true, updatedAt: true,
            },
        });
        res.json(articles);
    } catch (err) {
        console.error('[AnalyticalCms] listAnalytical:', err);
        res.status(500).json({ message: 'Failed to fetch analytical articles.' });
    }
};

// ─── GET single article (full, with signed URLs) ─────────────────────────────
export const getAnalytical = async (req, res) => {
    try {
        const article = await prisma.analyticalArticle.findUnique({ where: { id: req.params.id } });
        if (!article) return res.status(404).json({ message: 'Article not found.' });

        // Generate signed URLs for private S3 assets
        const [dataUrl, imageUrls] = await Promise.all([
            signedUrl(article.dataKey),
            Promise.all((article.images || []).map(key => signedUrl(key))),
        ]);

        res.json({ ...article, dataUrl, imageUrls });
    } catch (err) {
        console.error('[AnalyticalCms] getAnalytical:', err);
        res.status(500).json({ message: 'Failed to fetch article.' });
    }
};

// ─── CREATE analytical article ───────────────────────────────────────────────
export const createAnalytical = async (req, res) => {
    const {
        title, id: customId, headingDescription, readTime, mainImage,
        shortDescription, body, tags = [], dataKey, tableOfContents,
        faq, advertisement, images = [],
    } = req.body;

    if (!title)
        return res.status(400).json({ message: 'title is required.' });

    // Use custom ID or auto-generate from title
    const id = customId?.trim() || makeSlug(title);

    try {
        // Check uniqueness of id
        const exists = await prisma.analyticalArticle.findUnique({ where: { id } });
        if (exists)
            return res.status(409).json({ message: `Article with id "${id}" already exists. Choose a different title or id.` });

        const article = await prisma.analyticalArticle.create({
            data: {
                id, title,
                headingDescription: headingDescription || null,
                readTime:           readTime           || null,
                mainImage:          mainImage          || null,
                shortDescription:   shortDescription   || null,
                body:               body               || null,
                tags:               tags               || [],
                dataKey:            dataKey            || null,
                tableOfContents:    tableOfContents    || null,
                faq:                faq                || null,
                advertisement:      advertisement      || null,
                images:             images             || [],
            },
        });
        res.status(201).json(article);
    } catch (err) {
        console.error('[AnalyticalCms] createAnalytical:', err);
        res.status(500).json({ message: 'Failed to create article.' });
    }
};

// ─── UPDATE analytical article ───────────────────────────────────────────────
export const updateAnalytical = async (req, res) => {
    const { id } = req.params;
    // id is immutable — never update it (S3 folder path would break)
    const {
        title, headingDescription, readTime, mainImage, shortDescription,
        body, tags, dataKey, tableOfContents, faq, advertisement, images,
    } = req.body;

    try {
        const existing = await prisma.analyticalArticle.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Article not found.' });

        const article = await prisma.analyticalArticle.update({
            where: { id },
            data: {
                ...(title              !== undefined && { title }),
                ...(headingDescription !== undefined && { headingDescription }),
                ...(readTime           !== undefined && { readTime }),
                ...(mainImage          !== undefined && { mainImage }),
                ...(shortDescription   !== undefined && { shortDescription }),
                ...(body               !== undefined && { body }),
                ...(tags               !== undefined && { tags }),
                ...(dataKey            !== undefined && { dataKey }),
                ...(tableOfContents    !== undefined && { tableOfContents }),
                ...(faq                !== undefined && { faq }),
                ...(advertisement      !== undefined && { advertisement }),
                ...(images             !== undefined && { images }),
            },
        });
        res.json(article);
    } catch (err) {
        console.error('[AnalyticalCms] updateAnalytical:', err);
        res.status(500).json({ message: 'Failed to update article.' });
    }
};

// ─── DELETE analytical article ───────────────────────────────────────────────
export const deleteAnalytical = async (req, res) => {
    try {
        const existing = await prisma.analyticalArticle.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Article not found.' });
        await prisma.analyticalArticle.delete({ where: { id: req.params.id } });
        res.json({ message: 'Article deleted.' });
    } catch (err) {
        console.error('[AnalyticalCms] deleteAnalytical:', err);
        res.status(500).json({ message: 'Failed to delete article.' });
    }
};

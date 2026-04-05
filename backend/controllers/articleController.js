import prisma from '../prismaClient.js';
import { S3Client, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = process.env.AWS_ACCESS_KEY_ID ? new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
}) : null;

// Helper to construct fully qualified S3 URLs if necessary, or just return the key
const constructImageUrl = (req, filePath) => {
    if (!filePath) return null;
    // If it's already an S3 URL or external URL, return it
    if (filePath.startsWith('http')) return filePath;
    // Otherwise assume it's an S3 key and prepend the CloudFront/S3 domain
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
};

// Normalise any src value down to only the S3 key — never store full URLs or blob URLs
const extractS3Key = (src) => {
    if (!src) return null;
    // Blob URLs are session-local — discard them
    if (src.startsWith('blob:')) return null;
    // Strip presigned query string params first
    const clean = src.split('?')[0];
    // Full S3 virtual-hosted URL: https://bucket.s3.region.amazonaws.com/key
    const s3Virtual = clean.match(/\.s3\.[^/]+\.amazonaws\.com\/(.+)$/);
    if (s3Virtual) return s3Virtual[1];
    // Path-style S3 URL: https://s3.region.amazonaws.com/bucket/key
    const s3Path = clean.match(/s3\.[^/]+\.amazonaws\.com\/[^/]+\/(.+)$/);
    if (s3Path) return s3Path[1];
    // If it's any other http URL we don't recognise, discard it
    if (clean.startsWith('http')) return null;
    // Already a bare key
    return clean;
};

// Convert fully qualified URL or just a key into a signed URL
const getPresignedUrl = async (filePath) => {
    if (!filePath || !s3Client) return filePath;
    let key = filePath;
    const s3DomainRegex = /\.s3\.[^.]+\.amazonaws\.com\//;
    if (s3DomainRegex.test(filePath)) {
        key = filePath.split(s3DomainRegex)[1];
    } else if (filePath.startsWith('http')) {
        return filePath;
    }
    
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        });
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (e) {
        console.error("Error signing url", e);
        return filePath;
    }
};

const createArticle = async (req, res) => {
    try {
        const {
            title,
            shortDescription,
            type,
            readTime,
            timestampDate,
            tags,
            keyInsights,
            relatedNews,
            body,
            mainImage,
            images,
            id // Accept draftId if passed from frontend
        } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: "title and body are required" });
        }

        // Store only the S3 key for mainImage — never a full URL or presigned URL
        const mainImageKey = extractS3Key(mainImage) || (mainImage && !mainImage.startsWith('http') && !mainImage.startsWith('blob:') ? mainImage : null);

        // Build imagesToInsert from the images array sent by the frontend.
        // The frontend stores the clean S3 key in img.src — use that directly.
        // We also replace any markdown image syntax in the body with [IMAGE] placeholders.
        const imagesToInsert = (images || []).map(img => ({
            src: extractS3Key(img.src) || extractS3Key(img.previewUrl),
            alt: img.alt || null,
            caption: img.caption || null,
            link: img.link || null
        })).filter(img => img.src); // drop any that ended up with null src (e.g. blob-only)

        // Replace markdown image syntax ![…](…) and {{IMG_X}} with [IMAGE] in body
        let finalBody = body;
        const oldRegex = /\{\{IMG_(\d+)\}\}/g;
        finalBody = finalBody.replace(oldRegex, () => '[IMAGE]');
        const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        finalBody = finalBody.replace(mdImageRegex, () => '[IMAGE]');

        let articleIdToUse = id;
        if (!articleIdToUse) {
            const allIds = await prisma.article.findMany({ select: { id: true } });
            let maxNum = 0;
            allIds.forEach(a => {
                const m = a.id.match(/^article-(\d+)$/i);
                if (m) {
                    const n = parseInt(m[1], 10);
                    if (n > maxNum) maxNum = n;
                }
            });
            articleIdToUse = `article-${maxNum + 1}`;
        }

        const newArticle = await prisma.article.create({
            data: {
                id: articleIdToUse,
                title,
                shortDescription: shortDescription || null,
                type: type || null,
                readTime: readTime || null,
                timestampDate: timestampDate ? new Date(timestampDate) : new Date(),
                tags: tags || [],
                mainImage: mainImageKey,
                body: finalBody,

                images: {
                    create: imagesToInsert
                },
                keyInsights: {
                    create: (keyInsights || []).map(ki => ({
                        insightText: ki.insightText || ki
                    }))
                },
                relatedNews: {
                    create: (relatedNews || []).map(rn => ({
                        newsTitle: rn.newsTitle,
                        newsUrl: rn.newsUrl || null
                    }))
                }
            },
            include: {
                images: true,
                keyInsights: true,
                relatedNews: true
            }
        });

        // After creation, optionally return the created article with signed URLs instantly for editor update state
        if (newArticle.mainImage) newArticle.mainImage = await getPresignedUrl(newArticle.mainImage);
        if (newArticle.images) {
            for (let i = 0; i < newArticle.images.length; i++) {
                newArticle.images[i].src = await getPresignedUrl(newArticle.images[i].src);
            }
        }

        res.status(201).json({
            message: "Article created successfully!",
            id: newArticle.id,
            article: newArticle
        });

    } catch (error) {
        console.error("Error creating article:", error);
        res.status(500).json({ message: "Server error during article creation." });
    }
};

const updateArticle = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            shortDescription,
            type,
            readTime,
            timestampDate,
            tags,
            keyInsights,
            relatedNews,
            body,
            mainImage,
            images
        } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: "title and body are required" });
        }

        // Store only the S3 key for mainImage
        const mainImageKey = extractS3Key(mainImage) || (mainImage && !mainImage.startsWith('http') && !mainImage.startsWith('blob:') ? mainImage : null);

        // Use the images array directly — keys are already clean S3 keys from the upload
        const imagesToInsert = (images || []).map(img => ({
            src: extractS3Key(img.src) || extractS3Key(img.previewUrl),
            alt: img.alt || null,
            caption: img.caption || null,
            link: img.link || null
        })).filter(img => img.src);

        // Replace markdown image syntax and {{IMG_X}} with [IMAGE] in body
        let finalBody = body;
        const oldRegex = /\{\{IMG_(\d+)\}\}/g;
        finalBody = finalBody.replace(oldRegex, () => '[IMAGE]');
        const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        finalBody = finalBody.replace(mdImageRegex, () => '[IMAGE]');

        // Use Prisma's nested write to delete old relations and create new ones atomically.
        // onDelete: Cascade is set on the schema so we can delete via article.update directly,
        // but for image/insight/news we do explicit deleteMany then update to be safe.
        await prisma.articleImage.deleteMany({ where: { articleId: id } });
        await prisma.articleKeyInsight.deleteMany({ where: { articleId: id } });
        await prisma.articleRelatedNews.deleteMany({ where: { articleId: id } });

        const updatedArticle = await prisma.article.update({
            where: { id },
            data: {
                title,
                shortDescription: shortDescription || null,
                type: type || null,
                readTime: readTime || null,
                timestampDate: timestampDate ? new Date(timestampDate) : new Date(),
                tags: tags || [],
                mainImage: mainImageKey,
                body: finalBody,

                images: { create: imagesToInsert },
                keyInsights: {
                    create: (keyInsights || []).map(ki => ({
                        insightText: ki.insightText || ki
                    }))
                },
                relatedNews: {
                    create: (relatedNews || []).map(rn => ({
                        newsTitle: rn.newsTitle,
                        newsUrl: rn.newsUrl || null
                    }))
                }
            },
            include: { images: true, keyInsights: true, relatedNews: true }
        });

        if (updatedArticle.mainImage) updatedArticle.mainImage = await getPresignedUrl(updatedArticle.mainImage);
        if (updatedArticle.images) {
            for (let i = 0; i < updatedArticle.images.length; i++) {
                updatedArticle.images[i].src = await getPresignedUrl(updatedArticle.images[i].src);
            }
        }

        res.status(200).json({
            message: 'Article updated successfully!',
            id: updatedArticle.id,
            article: updatedArticle
        });
    } catch (error) {
        console.error('Error updating article:', error);
        res.status(500).json({ message: 'Server error during article update.', detail: error.message });
    }
};

const getArticles = async (req, res) => {
    try {
        const { search, type, page = 1, limit = 10 } = req.query;
        let where = {};

        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }
        if (type && type !== 'All Types') {
            where.type = { equals: type, mode: 'insensitive' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [articles, totalArticlesByFilter, typeGroup, overallTotalCount] = await Promise.all([
            prisma.article.findMany({
                where,
                skip,
                take,
                orderBy: { timestampDate: 'desc' },
                include: { images: true }
            }),
            prisma.article.count({ where }),
            prisma.article.groupBy({
                by: ['type'],
                _count: { id: true },
                where: { type: { not: null } }
            }),
            prisma.article.count()
        ]);
        
        // Collate case insensitive types
        const typeCounts = {};
        for (const tg of typeGroup) {
            if (!tg.type) continue;
            // Standardize output casing
            const stdType = tg.type.charAt(0).toUpperCase() + tg.type.slice(1).toLowerCase();
            typeCounts[stdType] = (typeCounts[stdType] || 0) + tg._count.id;
        }
        const availableTypesInfo = Object.keys(typeCounts).map(t => ({ name: t, count: typeCounts[t] }));

        const processBody = (body, images) => {
            if (!body || !images || images.length === 0) return body;
            let imgIndex = 0;
            return body.replace(/\[IMAGE\]/g, () => {
                const img = images[imgIndex++];
                if (img) {
                    const src = img.src;
                    const alt = img.alt || 'image';
                    return `![${alt}](${src})`;
                }
                return '[IMAGE]';
            });
        };

        const processedArticles = await Promise.all(articles.map(async (a) => {
            if (a.mainImage) a.mainImage = await getPresignedUrl(a.mainImage);
            if (a.images) {
                for (let i = 0; i < a.images.length; i++) {
                    a.images[i].src = await getPresignedUrl(a.images[i].src);
                }
            }
            return {
                ...a,
                body: processBody(a.body, a.images)
            };
        }));

        res.status(200).json({
            data: processedArticles,
            meta: {
                totalArticles: overallTotalCount,
                availableTypes: availableTypesInfo
            },
            pagination: {
                total: totalArticlesByFilter,
                totalPages: Math.ceil(totalArticlesByFilter / take),
                page: parseInt(page),
                limit: take
            }
        });
    } catch (error) {
        console.error("Error fetching articles:", error);
        res.status(500).json({ message: "Server error.", error: error.message });
    }
};

const getArticleById = async (req, res) => {
    try {
        const { id } = req.params;
        const article = await prisma.article.findUnique({
            where: { id },
            include: {
                images: true,
                keyInsights: true,
                relatedNews: true,
                comments: {
                    include: {
                        user: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }
        
        // Sign the base object URLs before returning to client!
        if (article.mainImage) article.mainImage = await getPresignedUrl(article.mainImage);
        
        if (article.images && article.images.length > 0) {
            for (let i = 0; i < article.images.length; i++) {
                article.images[i].src = await getPresignedUrl(article.images[i].src);
            }
        }

        if (article.body && article.images) {
            let imgIndex = 0;
            article.body = article.body.replace(/\[IMAGE\]/g, () => {
                const img = article.images[imgIndex++];
                if (img) {
                    const src = img.src; // Already signed above
                    const alt = img.alt || 'image';
                    return `![${alt}](${src})`;
                }
                return '[IMAGE]';
            });
        }

        res.status(200).json(article);
    } catch (error) {
        console.error("Error fetching article:", error);
        res.status(500).json({ message: "Server error." });
    }
};

const deleteArticle = async (req, res) => {
    try {
        const { id } = req.params;

        const article = await prisma.article.findUnique({ where: { id }, include: { images: true } });
        if (!article) return res.status(404).json({ message: 'Article not found.' });

        // --- Delete S3 folder (all objects under articleimage/article-{num}/) ---
        if (s3Client) {
            const numMatch = id.match(/^article-(\d+)$/);
            if (numMatch) {
                const prefix = `articleimage/article-${numMatch[1]}/`;
                try {
                    // List all objects under the prefix
                    const listRes = await s3Client.send(new ListObjectsV2Command({
                        Bucket: process.env.S3_BUCKET_NAME,
                        Prefix: prefix
                    }));

                    if (listRes.Contents && listRes.Contents.length > 0) {
                        await s3Client.send(new DeleteObjectsCommand({
                            Bucket: process.env.S3_BUCKET_NAME,
                            Delete: {
                                Objects: listRes.Contents.map(obj => ({ Key: obj.Key })),
                                Quiet: true
                            }
                        }));
                        console.log(`Deleted ${listRes.Contents.length} S3 object(s) under ${prefix}`);
                    }
                } catch (s3Err) {
                    // Log but don't fail the whole delete if S3 cleanup errors
                    console.error('S3 cleanup error (continuing with DB delete):', s3Err.message);
                }
            }
        }

        // --- Delete DB relations then article row ---
        // Since schema has onDelete: Cascade, deleting the article cascades to relations.
        // But we delete explicitly to be safe.
        await prisma.articleImage.deleteMany({ where: { articleId: id } });
        await prisma.articleKeyInsight.deleteMany({ where: { articleId: id } });
        await prisma.articleRelatedNews.deleteMany({ where: { articleId: id } });
        
        // --- Also delete any StagedArticle that was published to become this article ---
        // This prevents "ghost" PUBLISHED submissions from lingering in the journalist's panel
        await prisma.stagedArticle.deleteMany({ where: { publishedArticleId: id } });

        await prisma.article.delete({ where: { id } });

        res.status(200).json({ message: 'Article deleted successfully.' });
    } catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).json({ message: 'Server error during deletion.' });
    }
};

const getNextArticleId = async (req, res) => {
    try {
        const allArticles = await prisma.article.findMany({ select: { id: true } });
        let maxId = 0;
        allArticles.forEach(a => {
            const match = a.id.match(/^article-(\d+)$/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) maxId = num;
            }
        });
        res.status(200).json({ nextId: `article-${maxId + 1}` });
    } catch (error) {
        console.error("Error getting next article id:", error);
        res.status(500).json({ message: "Server error." });
    }
};

export {
    createArticle,
    updateArticle,
    getArticles,
    getArticleById,
    deleteArticle,
    getNextArticleId
};

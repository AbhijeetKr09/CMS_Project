import prisma from '../prismaClient.js';

async function main() {
    console.log('Starting migration to fix UUID articles...');

    // 1. Find the highest existing article-N ID
    const allArticles = await prisma.article.findMany({ select: { id: true } });
    let maxNum = 0;
    const uuidArticles = [];

    allArticles.forEach(a => {
        const m = a.id.match(/^article-(\d+)$/i);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
        } else {
            // It's a UUID or some other format
            uuidArticles.push(a.id);
        }
    });

    console.log(`Highest existing article ID number: ${maxNum}`);
    console.log(`Found ${uuidArticles.length} articles with non-standard IDs to migrate.`);

    if (uuidArticles.length === 0) {
        console.log('No migration needed.');
        return;
    }

    let nextNum = maxNum + 1;

    for (const oldId of uuidArticles) {
        const newId = `article-${nextNum++}`;
        console.log(`Migrating ${oldId} -> ${newId}`);

        // We can't just UPDATE the ID because it's a primary key with foreign key constraints.
        // Prisma doesn't natively support updating PKs easily if Cascade isn't set up perfectly or if it complains about foreign keys on update.
        // The safest approach is to read the old article with all relations, create the new one, update StagedArticle references, and delete the old one.

        await prisma.$transaction(async (tx) => {
            const oldArticle = await tx.article.findUnique({
                where: { id: oldId },
                include: {
                    images: true,
                    keyInsights: true,
                    relatedNews: true,
                }
            });

            if (!oldArticle) return;

            // 1. Create the new article with the new ID
            await tx.article.create({
                data: {
                    id:               newId,
                    title:            oldArticle.title,
                    timestampDate:    oldArticle.timestampDate,
                    readTime:         oldArticle.readTime,
                    mainImage:        oldArticle.mainImage,
                    shortDescription: oldArticle.shortDescription,
                    body:             oldArticle.body,
                    tags:             oldArticle.tags,
                    type:             oldArticle.type,
                    views:            oldArticle.views,
                    
                    images: {
                        create: oldArticle.images.map(({ src, alt, caption }) => ({ src, alt, caption }))
                    },
                    keyInsights: {
                        create: oldArticle.keyInsights.map(({ insightText }) => ({ insightText }))
                    },
                    relatedNews: {
                        create: oldArticle.relatedNews.map(({ newsTitle, newsUrl }) => ({ newsTitle, newsUrl }))
                    }
                }
            });

            // 2. Update any StagedArticles that point to this published article
            await tx.stagedArticle.updateMany({
                where: { publishedArticleId: oldId },
                data: { publishedArticleId: newId }
            });

            // 3. Update any SavedArticles pointing to this
            const savedItems = await tx.savedArticle.findMany({ where: { articleId: oldId } });
            for (const item of savedItems) {
                await tx.savedArticle.create({
                    data: {
                        userId: item.userId,
                        articleId: newId,
                        createdAt: item.createdAt
                    }
                });
            }
            await tx.savedArticle.deleteMany({ where: { articleId: oldId } });

            // 4. Update UserHistory pointing to this
            const historyItems = await tx.userHistory.findMany({ where: { articleId: oldId } });
            for (const item of historyItems) {
                await tx.userHistory.create({
                    data: {
                        userId: item.userId,
                        articleId: newId,
                        visitedAt: item.visitedAt
                    }
                });
            }
            await tx.userHistory.deleteMany({ where: { articleId: oldId } });
            
            // 5. Update Comments pointing to this
            const comments = await tx.comment.findMany({ where: { articleId: oldId } });
            for (const c of comments) {
                await tx.comment.create({
                    data: {
                        text: c.text,
                        createdAt: c.createdAt,
                        userId: c.userId,
                        articleId: newId,
                    }
                });
            }
            await tx.comment.deleteMany({ where: { articleId: oldId } });

            // 6. Delete old relations from the old article explicitly (just to be safe before deleting the article)
            await tx.articleImage.deleteMany({ where: { articleId: oldId } });
            await tx.articleKeyInsight.deleteMany({ where: { articleId: oldId } });
            await tx.articleRelatedNews.deleteMany({ where: { articleId: oldId } });
            
            // 7. Delete the old article
            await tx.article.delete({ where: { id: oldId } });
        });
        
        console.log(`Successfully migrated to ${newId}`);
    }

    console.log('Migration complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

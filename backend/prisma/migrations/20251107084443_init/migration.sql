-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timestampDate" TIMESTAMP(3) NOT NULL,
    "readTime" TEXT,
    "mainImage" TEXT,
    "shortDescription" TEXT,
    "body" TEXT,
    "tags" TEXT[],
    "type" TEXT,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_images" (
    "id" SERIAL NOT NULL,
    "src" TEXT NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "articleId" TEXT NOT NULL,

    CONSTRAINT "article_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_key_insights" (
    "id" SERIAL NOT NULL,
    "insightText" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,

    CONSTRAINT "article_key_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_related_news" (
    "id" SERIAL NOT NULL,
    "newsTitle" TEXT NOT NULL,
    "newsUrl" TEXT,
    "articleId" TEXT NOT NULL,

    CONSTRAINT "article_related_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "article_images" ADD CONSTRAINT "article_images_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_key_insights" ADD CONSTRAINT "article_key_insights_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_related_news" ADD CONSTRAINT "article_related_news_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

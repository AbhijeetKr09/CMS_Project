-- ============================================================
-- CMS Editor Workflow — Additive SQL Script (Updated)
-- Safe to run on existing database. Uses IF NOT EXISTS everywhere.
-- Run via pgAdmin, psql, or any Postgres client.
-- NOTE: You can also run `npx prisma db push` instead of this script.
-- ============================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "CmsRole" AS ENUM ('JOURNALIST', 'EDITOR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StagedArticleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. cms_users
CREATE TABLE IF NOT EXISTS cms_users (
  id            TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email         TEXT          NOT NULL UNIQUE,
  "passwordHash" TEXT         NOT NULL,
  name          TEXT          NOT NULL,
  role          "CmsRole"     NOT NULL DEFAULT 'JOURNALIST',
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. staged_articles
CREATE TABLE IF NOT EXISTS staged_articles (
  id                   TEXT                  PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title                TEXT                  NOT NULL DEFAULT '',
  body                 TEXT,
  "shortDescription"   TEXT,
  "mainImage"          TEXT,
  "readTime"           TEXT,
  tags                 TEXT[]                NOT NULL DEFAULT '{}',
  type                 TEXT,
  status               "StagedArticleStatus" NOT NULL DEFAULT 'DRAFT',
  "editorNote"         TEXT,
  "submittedById"      TEXT                  NOT NULL REFERENCES cms_users(id),
  "reviewedById"       TEXT                  REFERENCES cms_users(id),
  "publishedArticleId" TEXT                  UNIQUE,
  "createdAt"          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  "submittedAt"        TIMESTAMPTZ,
  "reviewedAt"         TIMESTAMPTZ
);

-- 4. staged_article_images
CREATE TABLE IF NOT EXISTS staged_article_images (
  id                SERIAL PRIMARY KEY,
  src               TEXT NOT NULL,
  alt               TEXT,
  caption           TEXT,
  "stagedArticleId" TEXT NOT NULL REFERENCES staged_articles(id) ON DELETE CASCADE
);

-- 5. staged_article_key_insights
CREATE TABLE IF NOT EXISTS staged_article_key_insights (
  id                SERIAL PRIMARY KEY,
  "insightText"     TEXT NOT NULL,
  "stagedArticleId" TEXT NOT NULL REFERENCES staged_articles(id) ON DELETE CASCADE
);

-- 6. staged_article_related_news
CREATE TABLE IF NOT EXISTS staged_article_related_news (
  id                SERIAL PRIMARY KEY,
  "newsTitle"       TEXT NOT NULL,
  "newsUrl"         TEXT,
  "stagedArticleId" TEXT NOT NULL REFERENCES staged_articles(id) ON DELETE CASCADE
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_staged_articles_submitted_by ON staged_articles("submittedById");
CREATE INDEX IF NOT EXISTS idx_staged_articles_status ON staged_articles(status);
CREATE INDEX IF NOT EXISTS idx_staged_article_images ON staged_article_images("stagedArticleId");
CREATE INDEX IF NOT EXISTS idx_staged_article_insights ON staged_article_key_insights("stagedArticleId");
CREATE INDEX IF NOT EXISTS idx_staged_article_news ON staged_article_related_news("stagedArticleId");

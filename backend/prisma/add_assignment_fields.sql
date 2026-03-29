-- Safe additive migration: adds assignedToId, assignedAt, recalledFromId to staged_articles
-- Run: psql $DATABASE_URL -f prisma/add_assignment_fields.sql

ALTER TABLE "staged_articles"
  ADD COLUMN IF NOT EXISTS "assignedToId"   TEXT REFERENCES "cms_users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "assignedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recalledFromId" TEXT;

-- Index for fast journalist assignment lookup
CREATE INDEX IF NOT EXISTS "staged_articles_assignedToId_idx" ON "staged_articles"("assignedToId");

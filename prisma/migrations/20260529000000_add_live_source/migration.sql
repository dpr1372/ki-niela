-- Add LiveSource enum
CREATE TYPE "LiveSource" AS ENUM ('NONE', 'API_AUTO', 'ADMIN_MANUAL');

-- Add columns to Match
ALTER TABLE "Match"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "externalProvider" TEXT,
  ADD COLUMN "liveSource" "LiveSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- Unique index on externalId (so we can map provider fixtures)
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

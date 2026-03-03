-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "VideoEmbedding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "videoId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "startChar" INTEGER,
    "endChar" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoEmbedding_videoId_idx" ON "VideoEmbedding"("videoId");

-- CreateIndex
CREATE INDEX "VideoEmbedding_transcriptId_idx" ON "VideoEmbedding"("transcriptId");

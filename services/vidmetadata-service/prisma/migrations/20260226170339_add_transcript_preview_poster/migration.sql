-- AlterEnum
ALTER TYPE "FileFormat" ADD VALUE 'POSTER';

-- CreateTable
CREATE TABLE "video_transcripts" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_transcripts_video_id_key" ON "video_transcripts"("video_id");

-- AddForeignKey
ALTER TABLE "video_transcripts" ADD CONSTRAINT "video_transcripts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `segments_json` to the `video_transcripts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "video_transcripts" ADD COLUMN     "segments_json" TEXT NOT NULL;

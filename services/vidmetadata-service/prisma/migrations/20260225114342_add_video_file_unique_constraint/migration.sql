/*
  Warnings:

  - A unique constraint covering the columns `[video_id,format]` on the table `video_files` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "video_files_video_id_format_key" ON "video_files"("video_id", "format");

/*
  Warnings:

  - A unique constraint covering the columns `[questionText]` on the table `questions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "questions_questionText_key" ON "questions"("questionText");

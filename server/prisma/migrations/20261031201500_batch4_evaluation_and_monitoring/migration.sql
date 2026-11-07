-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'AUTO_EVALUATED', 'MANUAL_EVALUATION_PENDING', 'EVALUATED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVALUATION_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "evaluationStatus" "EvaluationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "evaluationError" TEXT;
ALTER TABLE "attempts" ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "answers" ADD COLUMN IF NOT EXISTS "facultyFeedback" TEXT;
ALTER TABLE "answers" ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3);
ALTER TABLE "answers" ADD COLUMN IF NOT EXISTS "evaluatedById" TEXT;

-- AlterTable
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "isPassed" BOOLEAN;
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "evaluationStatus" "EvaluationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "evaluationNotes" TEXT;
ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_announcements" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exam_announcements_examId_idx" ON "exam_announcements"("examId");
CREATE INDEX IF NOT EXISTS "exam_announcements_senderId_idx" ON "exam_announcements"("senderId");
CREATE INDEX IF NOT EXISTS "exam_announcements_createdAt_idx" ON "exam_announcements"("createdAt");

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_announcements" ADD CONSTRAINT "exam_announcements_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_announcements" ADD CONSTRAINT "exam_announcements_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

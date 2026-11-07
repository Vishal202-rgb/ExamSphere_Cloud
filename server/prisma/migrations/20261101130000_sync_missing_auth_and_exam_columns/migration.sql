-- ==============================================================================
-- ExamSphere Migration: Sync Missing Auth, Exam, Question Columns & Indexes
-- Fixes P2022 schema mismatch for resetPasswordToken, resetPasswordExpiry, 
-- allowLateEntry, isPublished, isActive, and missing performance indexes.
-- ==============================================================================

-- AlterTable: exams
ALTER TABLE "exams" 
ADD COLUMN IF NOT EXISTS "allowLateEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: questions
ALTER TABLE "questions" 
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: users
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "resetPasswordExpiry" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "resetPasswordToken" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attempts_status_expiresAt_idx" ON "attempts"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "questions_isActive_idx" ON "questions"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "results_studentId_publicationStatus_idx" ON "results"("studentId", "publicationStatus");

-- ==============================================================================
-- ExamSphere Migration: Batch 3 Examination Engine & Session Tracking
-- Adds SubmissionReason enum, question/option shuffle persistence, optimistic locking
-- ==============================================================================

-- CreateEnum
CREATE TYPE "SubmissionReason" AS ENUM ('MANUAL', 'AUTO_TIMEOUT', 'ADMIN_TERMINATED');

-- AlterTable
ALTER TABLE "attempts" 
ADD COLUMN "submissionReason" "SubmissionReason",
ADD COLUMN "questionOrder" JSONB,
ADD COLUMN "optionOrder" JSONB;

-- AlterTable
ALTER TABLE "answers" 
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

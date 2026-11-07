-- Batch 5: Analytics, Coding Assessment, and Proctoring Assistance Migration
-- Alter QuestionType enum
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'CODING';

-- Create Enums
CREATE TYPE "CodingSubmissionStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'ACCEPTED',
    'WRONG_ANSWER',
    'TIME_LIMIT_EXCEEDED',
    'MEMORY_LIMIT_EXCEEDED',
    'COMPILATION_ERROR',
    'RUNTIME_ERROR',
    'INTERNAL_ERROR',
    'SETUP_REQUIRED'
);

CREATE TYPE "ProctoringEventType" AS ENUM (
    'TAB_BLUR',
    'TAB_FOCUS',
    'FULLSCREEN_EXIT',
    'FULLSCREEN_ENTER',
    'DISCONNECT',
    'RECONNECT',
    'SUSPICIOUS_KEY'
);

-- Create coding_question_details Table
CREATE TABLE "coding_question_details" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "inputFormat" TEXT,
    "outputFormat" TEXT,
    "constraints" TEXT,
    "allowedLanguages" JSONB,
    "starterCode" JSONB,
    "timeLimitSec" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 256,
    "evaluationPolicy" TEXT NOT NULL DEFAULT 'ALL_TEST_CASES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_question_details_pkey" PRIMARY KEY ("id")
);

-- Create coding_test_cases Table
CREATE TABLE "coding_test_cases" (
    "id" TEXT NOT NULL,
    "codingDetailId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_test_cases_pkey" PRIMARY KEY ("id")
);

-- Create coding_submissions Table
CREATE TABLE "coding_submissions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptId" TEXT,
    "examId" TEXT,
    "sourceCode" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "CodingSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "totalTestCases" INTEGER NOT NULL DEFAULT 0,
    "passedTestCases" INTEGER NOT NULL DEFAULT 0,
    "marksAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "executionTimeMs" DOUBLE PRECISION,
    "memoryUsedKb" INTEGER,
    "compileOutput" TEXT,
    "executionOutput" JSONB,
    "errorMessage" TEXT,
    "isSampleRun" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_submissions_pkey" PRIMARY KEY ("id")
);

-- Create proctoring_events Table
CREATE TABLE "proctoring_events" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventType" "ProctoringEventType" NOT NULL,
    "details" JSONB,
    "clientTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proctoring_events_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "coding_question_details_questionId_key" ON "coding_question_details"("questionId");

-- Indexes
CREATE INDEX "coding_test_cases_codingDetailId_idx" ON "coding_test_cases"("codingDetailId");
CREATE INDEX "coding_test_cases_codingDetailId_isSample_idx" ON "coding_test_cases"("codingDetailId", "isSample");

CREATE INDEX "coding_submissions_studentId_idx" ON "coding_submissions"("studentId");
CREATE INDEX "coding_submissions_questionId_idx" ON "coding_submissions"("questionId");
CREATE INDEX "coding_submissions_attemptId_idx" ON "coding_submissions"("attemptId");
CREATE INDEX "coding_submissions_examId_idx" ON "coding_submissions"("examId");
CREATE INDEX "coding_submissions_status_idx" ON "coding_submissions"("status");

CREATE INDEX "proctoring_events_attemptId_idx" ON "proctoring_events"("attemptId");
CREATE INDEX "proctoring_events_studentId_idx" ON "proctoring_events"("studentId");
CREATE INDEX "proctoring_events_eventType_idx" ON "proctoring_events"("eventType");
CREATE INDEX "proctoring_events_attemptId_clientTime_idx" ON "proctoring_events"("attemptId", "clientTime");

-- Foreign key constraints
ALTER TABLE "coding_question_details" ADD CONSTRAINT "coding_question_details_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coding_test_cases" ADD CONSTRAINT "coding_test_cases_codingDetailId_fkey" FOREIGN KEY ("codingDetailId") REFERENCES "coding_question_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==============================================================================
-- ExamSphere Migration: Multi-Course Exam Association (exam_courses)
-- Supports many-to-many relationship between Exams and Courses
-- ==============================================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_courses" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exam_courses_examId_courseId_key" ON "exam_courses"("examId", "courseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exam_courses_examId_idx" ON "exam_courses"("examId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exam_courses_courseId_idx" ON "exam_courses"("courseId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exam_courses_examId_fkey'
    ) THEN
        ALTER TABLE "exam_courses" ADD CONSTRAINT "exam_courses_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exam_courses_courseId_fkey'
    ) THEN
        ALTER TABLE "exam_courses" ADD CONSTRAINT "exam_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing exams into exam_courses
INSERT INTO "exam_courses" ("id", "examId", "courseId", "createdAt")
SELECT gen_random_uuid()::text, "id", "courseId", CURRENT_TIMESTAMP
FROM "exams"
WHERE "courseId" IS NOT NULL
ON CONFLICT ("examId", "courseId") DO NOTHING;

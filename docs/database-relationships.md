# ExamSphere – Database Relationships & Integrity Rules

This document details all relational mappings, cardinalities, and foreign key cascade policies implemented in the ExamSphere Prisma schema.

---

## 1. Relational Cardinality Matrix

| Source Entity | Target Entity | Cardinality | Join Mechanism / Model | Cascade Action |
| :--- | :--- | :---: | :--- | :--- |
| **Department** | **User** | `1 : N` | `User.departmentId` → `Department.id` | `onDelete: SetNull` |
| **Department** | **Course** | `1 : N` | `Course.departmentId` → `Department.id` | `onDelete: Cascade` |
| **Course** | **User (Faculty)** | `M : N` | `CourseFaculty` (`courseId`, `facultyId`) | `onDelete: Cascade` |
| **Course** | **User (Student)** | `M : N` | `StudentEnrollment` (`courseId`, `studentId`) | `onDelete: Cascade` |
| **Course** | **Question** | `1 : N` | `Question.courseId` → `Course.id` | `onDelete: Cascade` |
| **User (Faculty)** | **Question** | `1 : N` | `Question.createdById` → `User.id` | `onDelete: Cascade` |
| **Question** | **QuestionOption** | `1 : N` | `QuestionOption.questionId` → `Question.id`| `onDelete: Cascade` |
| **Course** | **Exam** | `1 : N` | `Exam.courseId` → `Course.id` | `onDelete: Cascade` |
| **User (Faculty)** | **Exam** | `1 : N` | `Exam.createdById` → `User.id` | `onDelete: Cascade` |
| **Exam** | **Question** | `M : N` | `ExamQuestion` (`examId`, `questionId`) | `onDelete: Cascade` |
| **Exam** | **User (Student)** | `M : N` | `ExamAssignment` (`examId`, `studentId`) | `onDelete: Cascade` |
| **Exam** | **Attempt** | `1 : N` | `Attempt.examId` → `Exam.id` | `onDelete: Cascade` |
| **User (Student)** | **Attempt** | `1 : N` | `Attempt.studentId` → `User.id` | `onDelete: Cascade` |
| **Attempt** | **Answer** | `1 : N` | `Answer.attemptId` → `Attempt.id` | `onDelete: Cascade` |
| **Question** | **Answer** | `1 : N` | `Answer.questionId` → `Question.id` | `onDelete: Cascade` |
| **Attempt** | **Result** | `1 : 1` | `Result.attemptId` → `Attempt.id` (Unique) | `onDelete: Cascade` |
| **Exam** | **Result** | `1 : N` | `Result.examId` → `Exam.id` | `onDelete: Cascade` |
| **User (Student)** | **Result** | `1 : N` | `Result.studentId` → `User.id` | `onDelete: Cascade` |
| **User** | **Notification** | `1 : N` | `Notification.userId` → `User.id` | `onDelete: Cascade` |
| **User** | **AuditLog** | `1 : N` | `AuditLog.userId` → `User.id` | `onDelete: SetNull` |

---

## 2. In-Depth Relationship Specifications

### 2.1 Academic Hierarchy & Staffing
1. **Department to Users (`1:N`)**:
   - A department employs faculty, houses administrative officers, and admits students.
   - If a department is decommissioned, `User.departmentId` is set to `NULL` (`onDelete: SetNull`) to retain user identity and historic audit logs without dangling foreign keys.
2. **Department to Courses (`1:N`)**:
   - Each academic course is owned by a single department. Deleting a department cascades down to its courses.
3. **Course to Faculty (`M:N` via `CourseFaculty`)**:
   - A single course may have multiple instructors (e.g. lectures, lab sections).
   - A faculty member may teach multiple courses.
   - The join table `CourseFaculty` contains metadata such as `isCoordinator` and enforces `@@unique([courseId, facultyId])`.

### 2.2 Student Enrollment
4. **Course to Students (`M:N` via `StudentEnrollment`)**:
   - Students register for multiple courses per term.
   - Includes lifecycle tracking (`status`: `ACTIVE`, `DROPPED`, `COMPLETED`).
   - Prevents duplicate enrollments via `@@unique([courseId, studentId])`.

### 2.3 Question Bank Architecture
5. **Course to Questions (`1:N`)**:
   - Questions belong to a course repository so they can be reused across multiple examination iterations (midterms, finals, surprise quizzes).
6. **Question to QuestionOptions (`1:N`)**:
   - `SINGLE_MCQ`, `MULTIPLE_MCQ`, and `TRUE_FALSE` questions decompose into `QuestionOption` rows.
   - Deleting a question cascades to all choices.

### 2.4 Examination Assembly & Eligibility
7. **Exam to Questions (`M:N` via `ExamQuestion`)**:
   - Exams draw questions from the course question bank.
   - `ExamQuestion` stores exam-specific ordering (`orderIndex`) and optional exam-specific scoring overrides (`marks`, `negativeMarks`).
   - Enforces `@@unique([examId, questionId])` to prevent duplicate inclusion in a single exam.
8. **Exam to Students (`M:N` via `ExamAssignment`)**:
   - Rosters eligible candidates for an exam.
   - Enables student-specific accommodations via `extraTimeMinutes` and academic integrity flags via `isDisqualified`.
   - Enforces `@@unique([examId, studentId])`.

### 2.5 Real-Time Examination Taking & Telemetry
9. **Student & Exam to Attempts (`1:N`)**:
   - A candidate can take an exam up to `Exam.maxAttempts` times.
   - Enforces composite uniqueness: `@@unique([examId, studentId, attemptNumber])`.
   - Tracks telemetry including `tabSwitchCount`, `ipAddress`, and `userAgent`.
10. **Attempt to Answers (`1:N`)**:
    - Each question answered during an attempt corresponds to exactly one `Answer` row.
    - Guaranteed unique via `@@unique([attemptId, questionId])`.
    - Holds selected option IDs (in JSON array) or `descriptiveAnswer` text.

### 2.6 Grading & Scorecard Delivery
11. **Attempt to Result (`1:1`)**:
    - An evaluated attempt yields exactly one official `Result` record.
    - `Result.attemptId` is marked `@unique` to ensure a 1-to-1 relationship.
    - Results link back to `Exam` and `User` directly for efficient batch grade sheet queries.

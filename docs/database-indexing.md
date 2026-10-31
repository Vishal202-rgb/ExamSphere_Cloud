# ExamSphere – Database Indexing & Optimization Strategy

This document outlines the indexing strategy implemented across the ExamSphere PostgreSQL schema to support high-concurrency exam submissions, instant leaderboards, and sub-millisecond authentication.

---

## 1. Indexing Inventory & Rationale

### 1. User Identity & Authentication (`users`)
| Index Definition | Type | Purpose & Query Pattern |
| :--- | :--- | :--- |
| `email` | Unique B-Tree | `WHERE email = ?` (Login & JWT issuance: `O(1)` index seek) |
| `rollNumber` | Unique B-Tree | `WHERE rollNumber = ?` (Academic record search, transcript lookups) |
| `role` | Single-Column | `WHERE role = 'FACULTY'` (Role-based roster filtering) |
| `departmentId` | Single-Column | `WHERE departmentId = ?` (Departmental personnel lists) |
| `[batch, section]` | Compound | `WHERE batch = '2023-2027' AND section = 'A'` (Batch-level exam assignment) |

### 2. Course Catalog & Staffing (`courses`, `course_faculty`, `student_enrollments`)
| Index Definition | Type | Purpose & Query Pattern |
| :--- | :--- | :--- |
| `courses.code` | Unique B-Tree | `WHERE code = 'CS301'` (Course syllabus lookup) |
| `courses.departmentId` | Single-Column | `WHERE departmentId = ?` (Department course catalog) |
| `course_faculty.[courseId, facultyId]` | Unique Compound | Prevents duplicate faculty assignment & speeds `WHERE courseId = ?` |
| `student_enrollments.[courseId, studentId]` | Unique Compound | Prevents duplicate enrollment & accelerates membership checks |
| `student_enrollments.status` | Single-Column | Filters active vs dropped students for roster imports |

### 3. Question Bank (`questions`, `question_options`)
| Index Definition | Type | Purpose & Query Pattern |
| :--- | :--- | :--- |
| `questions.courseId` | Single-Column | `WHERE courseId = ?` (Loads course question repository) |
| `questions.createdById` | Single-Column | `WHERE createdById = ?` (Faculty personal authoring dashboard) |
| `questions.type` | Single-Column | Filters questions by format (`SINGLE_MCQ`, `DESCRIPTIVE`) |
| `questions.difficulty` | Single-Column | Dynamic test generation: draws N easy, M medium, K hard questions |
| `question_options.[questionId, orderIndex]` | Compound | Rapid ordered rendering of choices for candidate screens |

### 4. Examination Engine (`exams`, `exam_questions`, `exam_assignments`)
| Index Definition | Type | Purpose & Query Pattern |
| :--- | :--- | :--- |
| `exams.status` | Single-Column | Lifecycle worker queries: finds `SCHEDULED` or `LIVE` exams |
| `exams.startTime` | Single-Column | Scheduler time-window queries: `WHERE startTime <= NOW()` |
| `exams.[courseId, status]` | Compound | Student dashboard: `WHERE courseId = ? AND status = 'LIVE'` |
| `exams.[startTime, endTime]` | Compound | Prevents conflicting examination schedule overlaps |
| `exam_questions.[examId, questionId]` | Unique Compound | Guarantees no duplicate question in a single exam paper |
| `exam_questions.[examId, orderIndex]` | Compound | Fetches exam paper in sorted chronological question order |
| `exam_assignments.[examId, studentId]` | Unique Compound | Fast gatekeeper: verifies candidate eligibility on exam launch |

### 5. High-Concurrency Test Taking (`attempts`, `answers`)
| Index Definition | Type | Purpose & Query Pattern |
| :--- | :--- | :--- |
| `attempts.[examId, studentId, attemptNumber]`| Unique Compound | Restricts candidate to `Exam.maxAttempts` (concurrency guard) |
| `attempts.[examId, studentId]` | Compound | Student session resume check: `WHERE examId = ? AND studentId = ?` |
| `attempts.[examId, status]` | Compound | Faculty live proctoring monitor: lists candidates `IN_PROGRESS` |
| `answers.[attemptId, questionId]` | Unique Compound | Fast upsert during continuous auto-saving of candidate responses |
| `answers.attemptId` | Single-Column | Bulk evaluation job: gathers all answers for an attempt in one query |

### 6. Results, Analytics & Notifications (`results`, `notifications`, `audit_logs`)
| Index Definition | Type | Purpose & Query Pattern |
| :--- | :--- | :--- |
| `results.attemptId` | Unique B-Tree | 1-to-1 score linking with attempt |
| `results.[examId, rank]` | Compound | Leaderboard generation sorted by rank (`ORDER BY rank ASC`) |
| `results.[examId, studentId]` | Compound | Individual student result lookup |
| `results.[examId, publicationStatus]`| Compound | Bulk publication toggle and moderated grade sheet delivery |
| `notifications.[userId, isRead]` | Compound | Header unread notification bell: `WHERE userId = ? AND isRead = false` |
| `audit_logs.[userId, timestamp]` | Compound | Security forensic timeline of a specific user |
| `audit_logs.[action, timestamp]` | Compound | Compliance review: filters by action type (`LOGIN`, `SUBMIT_EXAM`) |

---

## 2. High-Concurrency Write Optimizations

1. **Upsert Concurrency in Candidate Submissions**:
   - During live examinations with hundreds of simultaneous candidates saving answers every few seconds, the compound unique constraint `@@unique([attemptId, questionId])` on the `answers` table allows PostgreSQL to execute high-throughput `INSERT ... ON CONFLICT (attempt_id, question_id) DO UPDATE` operations without table-level locking.
2. **Elimination of Sequential Table Scans**:
   - Foreign key columns (`courseId`, `studentId`, `examId`, `attemptId`) are explicitly indexed. PostgreSQL does not automatically create indexes on foreign keys; having these indexes eliminates table locks during cascading deletions and foreign key checks.
3. **Optimized B-Tree Depth**:
   - UUID primary keys (36-character canonical strings) are indexed using B-Trees, which provide consistent `O(log N)` lookup times.

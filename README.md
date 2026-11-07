# ExamSphere – Cloud-Based Online Examination & Assessment Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/architecture-Modular%20Monolith-indigo.svg)
![Phases](https://img.shields.io/badge/phases%20completed-1%20through%2015-emerald.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)

**ExamSphere** is an enterprise-grade, cloud-native online examination and automated assessment platform designed to deliver secure, cheat-resistant, and high-concurrency exams. Built with a modular monolith architecture, it supports fine-grained Role-Based Access Control (RBAC), timed exam sessions, real-time proctoring telemetry, automated objective grading, and resilient background job processing.

---

## 🏗️ Architecture & Design Principles

- **Modular Monolith**: Organized cleanly into feature modules (`auth`, `departments`, `courses`, `admin`, `users`, `faculty`, `student`, `questions`, `exams`, `attempts`, `evaluation`, `notifications`, `monitoring`, `health`) with strict boundaries.
- **Service & Repository Patterns**: Controllers strictly orchestrate HTTP requests/responses, delegating business logic to Services, while database interactions are encapsulated inside Repositories via Prisma ORM.
- **Server-Authoritative Timer**: Examination time is computed strictly on the backend (`expiresAt - currentServerTime`). The frontend periodically synchronizes with the server, preventing device clock tampering or local refresh exploits.
- **Debounced Autosave with Optimistic Concurrency**: Candidate responses are automatically debounced on the client, version-checked on the server to reject stale out-of-order writes, and atomically upserted into PostgreSQL.
- **Automated Objective & Manual Subjective Grading**:
  - Automatically evaluates `SINGLE_MCQ`, `MULTIPLE_MCQ` (exact set matching), and `TRUE_FALSE` with configurable negative marking.
  - Places attempts with `DESCRIPTIVE` answers into `MANUAL_EVALUATION_PENDING` for instructor rubric grading and qualitative feedback.
- **Standard Competition Ranking (1, 1, 3)**: Mathematically handles tied scores on result publication.
- **Authenticated Real-Time Socket.IO Gateway**:
  - Validates JWT tokens on WebSocket handshakes with least-privilege room isolation (`exam:<id>`, `user:<id>`).
  - Broadcasts live candidate presence (online/offline), attempt starts, submissions, timeouts, and urgent announcements.
- **Deduplicated Persistent Notifications**: Backed by PostgreSQL and pushed instantly over Socket.IO.
- **Role-Based Access Control (RBAC)**: Enforces principle of least privilege with distinct roles (`ADMIN`, `FACULTY`, `STUDENT`).
- **Fail-Fast Environment Validation**: Powered by Zod schemas at application bootstrap.
- **Centralized Error Handling**: Standardized operational error envelope (`ApiError`) and global middleware.
- **Brute-Force & Rate-Limiting Protection**: Express rate limiting on sensitive authentication and recovery endpoints.
- **HttpOnly Cookies & Token Rotation**: Secure refresh token rotation preventing replay attacks.

---

## 💻 Technology Stack

### Frontend (`client/`)
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | 19.x | Modern UI rendering with Concurrent Mode |
| **Vite** | 8.x | High-speed frontend build and dev server |
| **Tailwind CSS** | 3.4.x | Utility-first styling with modern dark theme & glassmorphism |
| **Redux Toolkit** | 2.x | Centralized authentication and examination session state |
| **React Router** | 7.x | Client-side routing with role-based `ProtectedRoute` guards |
| **Axios** | 1.x | HTTP client with automatic 401 token refresh queue & retry backoff |
| **Recharts** | 3.x | Reactive telemetry and enrollment charts |
| **Lucide React** | Latest | Modern iconography |

### Backend (`server/`)
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | 20.x / 22.x | High-performance asynchronous runtime |
| **Express.js** | 4.21.x | REST API web framework |
| **PostgreSQL** | 16 / 18 | Relational database engine |
| **Prisma ORM** | 6.x | Type-safe query builder, dual Linux/Windows binary targets |
| **Redis** | 7 | In-memory cache, session store, and BullMQ transport |
| **BullMQ** | 5.x | Distributed background job queue for async evaluation |
| **Socket.IO** | 4.8.x | Real-time bi-directional telemetry and proctoring |
| **JWT & bcryptjs** | Latest | Secure token authentication (12 salt rounds) |
| **Zod** | 3.24.x | Runtime schema validation |
| **Multer & csv-parse** | Latest | Multipart CSV bulk parsing with atomic DB transactions |

---

## 🔑 Demo & Seeder Credentials

| Role | Email | Password | Assigned Details |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@examsphere.io` | `Admin@12345` | Platform Super Administrator |
| **FACULTY** | `alan.turing@examsphere.io` | `Faculty@12345` | Dept of Computer Science & Engineering (Lead) |
| **STUDENT** | `john.doe@examsphere.io` | `Student@12345` | Roll No: `CS2023001`, Batch: `2023-2027`, Sec: `A` |

---

## 🛡️ Role-Based Access Control (RBAC) Matrix

| Feature / Domain | ADMIN | FACULTY | STUDENT |
| :--- | :---: | :---: | :---: |
| Admin Operations Dashboard & KPIs | ✅ | ❌ | ❌ |
| Department & Course CRUD Management | ✅ | ❌ | ❌ |
| Faculty Account Provisioning | ✅ | ❌ | ❌ |
| Student Account Creation & CSV Bulk Import | ✅ | ❌ | ❌ |
| Account Deactivation / Activation Control | ✅ | ❌ | ❌ |
| View Assigned Courses & Enrolled Students | ✅ | ✅ | ❌ |
| Question Bank & Exam Authoring/Publishing | ✅ | ✅ | ❌ |
| View Personal Assigned & Live Examinations | ❌ | ❌ | ✅ |
| Start, Resume & Submit Timed Examination | ❌ | ❌ | ✅ |

---

## 🔌 API Endpoints Summary (Phases 3–9)

### Authentication & Recovery (`/api/v1/auth`)
- `POST /api/v1/auth/login` - Authenticate user, issue JWT access token & HttpOnly refresh token
- `POST /api/v1/auth/logout` - Invalidate session, revoke refresh token, clear cookies
- `POST /api/v1/auth/refresh` - Rotate refresh token and issue new access token
- `POST /api/v1/auth/forgot-password` - Request crypto reset token for account
- `POST /api/v1/auth/reset-password` - Validate token and update account password
- `GET  /api/v1/auth/me` - Retrieve current user profile and role

### Admin Operations & Telemetry (`/api/v1/admin`)
- `GET /api/v1/admin/stats` - Fetch aggregated KPIs, department distributions, and audit logs

### Academic Departments (`/api/v1/departments`)
- `GET    /api/v1/departments` - List departments with pagination & search
- `POST   /api/v1/departments` - Register new academic department
- `GET    /api/v1/departments/:id` - Retrieve department details
- `PUT    /api/v1/departments/:id` - Update department information
- `DELETE /api/v1/departments/:id` - Delete department

### Course Curricula (`/api/v1/courses`)
- `GET    /api/v1/courses` - List courses with department filter, search & pagination
- `POST   /api/v1/courses` - Register course (code, title, credits, department)
- `GET    /api/v1/courses/:id` - Retrieve course details and instructors
- `PUT    /api/v1/courses/:id` - Update course metadata
- `DELETE /api/v1/courses/:id` - Delete course
- `POST   /api/v1/courses/:id/faculty` - Assign faculty instructor and coordinator role

### User Management & Cohorts (`/api/v1/users`)
- `GET   /api/v1/users` - Search users by role, department, active status
- `POST  /api/v1/users/faculty` - Provision faculty account
- `POST  /api/v1/users/students` - Register individual student with roll number & batch
- `PATCH /api/v1/users/:id/status` - Activate or deactivate user account
- `POST  /api/v1/users/students/bulk-import` - Atomic bulk CSV student import with duplicate validation
- `GET   /api/v1/users/students/export` - Export student records as CSV download

### Question Bank Management (`/api/v1/questions`)
- `POST   /api/v1/questions` - Create question (SINGLE_MCQ, MULTIPLE_MCQ, TRUE_FALSE, DESCRIPTIVE) with marks & rubric
- `GET    /api/v1/questions` - List questions with course, type, difficulty, search & pagination filters
- `GET    /api/v1/questions/:id` - Retrieve full question specifications and options (student privacy protected)
- `PUT    /api/v1/questions/:id` - Update question prompt, marks, difficulty, or options
- `DELETE /api/v1/questions/:id` - Archive / soft-delete question from active bank
- `POST   /api/v1/questions/import` - Bulk import questions via CSV in an atomic database transaction
- `GET    /api/v1/questions/export` - Export course questions as formatted CSV download

### Examination Lifecycle & Scheduling (`/api/v1/exams`)
- `POST   /api/v1/exams` - Create examination in `DRAFT` status with proctoring parameters
- `GET    /api/v1/exams` - List examinations with course, status, search & pagination filters
- `GET    /api/v1/exams/:id` - Retrieve examination details, questions, and assigned roster
- `PUT    /api/v1/exams/:id` - Update examination configuration (duration, schedule, security toggles)
- `DELETE /api/v1/exams/:id` - Delete draft examination
- `PATCH  /api/v1/exams/:id/publish` - Validate and publish exam (transitions to `SCHEDULED` or `LIVE`)
- `PATCH  /api/v1/exams/:id/cancel` - Cancel active or scheduled examination
- `POST   /api/v1/exams/:id/questions` - Attach questions from bank and recompute total marks
- `DELETE /api/v1/exams/:id/questions/:questionId` - Detach question and adjust total marks
- `POST   /api/v1/exams/:id/assign` - Assign examination to students by batch, section, or roster
- `GET    /api/v1/exams/:id/assignments` - View candidate assignment roster
- `POST   /api/v1/exams/:id/start` - Authenticate, validate enrollment, randomize order, and start attempt

### Student Examination Portal (`/api/v1/student`)
- `GET    /api/v1/student/exams` - List assigned exams categorized by Live, Available, Upcoming, Completed
- `GET    /api/v1/student/exams/:examId` - View pre-flight examination instructions and integrity brief
- `GET    /api/v1/student/results` - View student's published examination results and competition ranks
- `GET    /api/v1/student/exams/:examId/result` - Detailed score breakdown and faculty feedback for published exam
- `GET    /api/v1/student/exams/:examId/announcements` - View real-time announcement history for assigned exam

### Examination Engine & Session Attempts (`/api/v1/attempts`)
- `GET    /api/v1/attempts/:attemptId` - Resume existing in-progress attempt, recover questions & saved answers
- `GET    /api/v1/attempts/:attemptId/time` - Synchronize server-authoritative remaining time
- `PUT    /api/v1/attempts/:attemptId/answers/:questionId` - Debounced autosave response with optimistic concurrency
- `POST   /api/v1/attempts/:attemptId/submit` - Idempotently submit attempt (MANUAL, AUTO_TIMEOUT, ADMIN_TERMINATED)

### Evaluation & Result Management (`/api/v1/faculty`)
- `GET    /api/v1/faculty/exams/:examId/submissions` - List submissions with filtering, evaluation statuses, and stats
- `GET    /api/v1/faculty/attempts/:attemptId` - Retrieve student answers, correct options, and grading rubric
- `PUT    /api/v1/faculty/attempts/:attemptId/evaluate` - Manual grading of descriptive questions with mark validation
- `POST   /api/v1/faculty/attempts/:attemptId/finalize` - Finalize attempt evaluation and transition status to EVALUATED
- `POST   /api/v1/faculty/exams/:examId/publish-results` - Calculate competition rankings (1, 1, 3) and publish results
- `GET    /api/v1/faculty/exams/:examId/results/export` - Export exam results as CSV

### Real-Time Monitoring & Telemetry (`/api/v1/faculty`)
- `GET    /api/v1/faculty/exams/:examId/monitoring` - Live candidate telemetries, presence, and attempt progress
- `POST   /api/v1/faculty/exams/:examId/announcements` - Broadcast urgent real-time announcement to exam room

### Persistent Notifications (`/api/v1/notifications`)
- `GET    /api/v1/notifications` - Paginated user notification feed with unread filter
- `GET    /api/v1/notifications/unread-count` - Fast unread notification counter
- `PATCH  /api/v1/notifications/:id/read` - Mark individual notification as read
- `PATCH  /api/v1/notifications/read-all` - Mark all notifications as read

### Advanced Analytics & Reporting (`/api/v1/analytics`)
- `GET    /api/v1/analytics/admin/overview` - Institution-wide analytics, exam trends, completion stats, pass/fail and score distributions (Redis-cached)
- `GET    /api/v1/analytics/faculty/overview` - Faculty-specific course analytics and authorized exam statistics
- `GET    /api/v1/analytics/faculty/exams/:examId` - Deep-dive exam analytics: question accuracy, skipped questions, difficult questions
- `GET    /api/v1/analytics/student/overview` - Student's private performance metrics across published exam results
- `GET    /api/v1/analytics/student/performance-trend` - Chronological score progression over time for personal analytics
- `GET    /api/v1/analytics/reports/department-summary` - Export department summary report as downloadable CSV
- `GET    /api/v1/analytics/reports/question-analysis/:examId` - Export question accuracy and difficulty index report as CSV
- `GET    /api/v1/analytics/reports/faculty-exam-summary/:examId` - Export comprehensive exam performance report as CSV
- `GET    /api/v1/analytics/reports/student-performance/:studentId?` - Export student academic transcript as CSV

### Coding Assessment & Code Execution (`/api/v1/coding`)
- `POST   /api/v1/coding/questions` - Create CODING question with problem statement, starter code, sample & hidden test cases
- `PUT    /api/v1/coding/questions/:questionId` - Update coding question configuration and test case definitions
- `GET    /api/v1/coding/questions/:questionId` - Retrieve coding question details (strictly excludes hidden test cases for students)
- `POST   /api/v1/coding/run` - Execute source code against sample test cases or custom STDIN in isolated runner
- `POST   /api/v1/coding/submissions` - Submit solution for grading against all test cases with evaluation policy enforcement
- `GET    /api/v1/coding/questions/:questionId/submissions` - Retrieve candidate code submission history

### Proctoring Assistance & Exam Integrity (`/api/v1/proctoring`)
- `POST   /api/v1/proctoring/events` - Rate-limited recording of browser integrity events (`TAB_BLUR`, `FULLSCREEN_EXIT`, etc.)
- `GET    /api/v1/proctoring/attempts/:attemptId` - Faculty candidate activity timeline with neutral review notices

---

## 🚀 Running the Project

### 1. Start Database & Cache
In WSL Ubuntu or Docker:
```bash
sudo service postgresql start
sudo service redis-server start
```

### 2. Run Database Migrations & Seeds
```bash
npm run prisma:generate
npm run seed
```

### 3. Verify End-to-End API Test Suites
Run the automated test suites covering all platform modules:
```bash
# Full Platform Test Suite (Batches 3, 4, 5):
npm --prefix server test
# Result: 42/42 Passed (100% Success across 3 test suites)
# - Batch 3: Examination Engine & Session Interface (17 tests)
# - Batch 4: Evaluation, Result Management & Monitoring (14 tests)
# - Batch 5: Analytics, Coding Assessment & Proctoring (11 tests)
```

### 4. Start Development Servers
**Backend API (Port 5000):**
```bash
npm run dev:server
```

**Frontend Client (Port 5173):**
```bash
npm run dev:client
```

Visit **http://localhost:5173** to log in using the quick demo credential switcher.

---

## 📌 Development Roadmap

- [x] **Phase 1**: Project Initialization & Environment Setup
- [x] **Phase 2**: Database Architecture & Relational Schema (19 Prisma Models)
- [x] **Phase 3**: Complete Authentication & Role-Based Access Control (RBAC)
- [x] **Phase 4**: Admin Operations Dashboard, Telemetry & Department/Course Management
- [x] **Phase 5**: Faculty & Student Management, Bulk CSV Import & Dedicated Portals
- [x] **Phase 6**: Question Bank Management (Single MCQ, Multi MCQ, True/False, Descriptive, CSV Import/Export)
- [x] **Phase 7**: Exam Creation and Scheduling (6-Step Wizard, Question Reordering, Marks Calculation, Anti-Cheat, Publishing)
- [x] **Phase 8**: Student Examination Interface (Dashboard, Pre-flight Briefing, Distraction-Free UI, Color-Coded Palette)
- [x] **Phase 9**: Examination Engine (Authoritative Timer, Debounced Autosave, Optimistic Concurrency, Resumption, Idempotent Submission & Worker)
- [x] **Phase 10**: Evaluation and Result Management (Auto-Evaluation, Exact MCQ Match, Negative Marking, Faculty Manual Grading, Competition Ranking, CSV Export)
- [x] **Phase 11**: Real-Time Monitoring & Notifications (Socket.IO Authenticated Gateway, Live Presence, Urgent Announcements, Deduplicated Persistent Notifications)
- [x] **Phase 12**: Analytics and Reporting (Admin & Faculty Recharts Dashboards, Question Diagnostics, Redis Aggregation Caching & CSV Export)
- [x] **Phase 13**: Coding Assessment & Proctoring Assistance (Monaco Editor, Secure Isolated Execution Abstraction, Hidden Test Privacy, Neutral Integrity Telemetry)
- [x] **Phase 14**: Security and Scalability (Helmet, Rate Limiting, Request ID Tracing, Error Masking, Route Lazy-Loading, Health Probes)
- [x] **Phase 15**: Docker, AWS Deployment and College Pilot (Multi-Stage Dockerfiles, Nginx Reverse Proxy, 100-Student Load Testing, CI/CD & Pilot Readiness)

---

## 🔒 Phase 14: Security, Resilience & Scalability

1. **Request Tracing & Observability**: Every request is assigned a unique `X-Request-Id` (UUID) propagating through headers, error responses, and audit logs.
2. **Hardened Multi-Tier Rate Limiting**:
   - `authLimiter`: 20 requests per 15 minutes per IP.
   - `passwordResetLimiter`: 5 requests per hour.
   - `submissionLimiter`: 60 autosave/submit actions per minute.
   - `codingExecutionLimiter`: 20 runs per minute protecting execution sandboxes.
   - `apiLimiter`: 600 requests per 15 minutes per IP.
3. **Production Error Masking**: Sanitizes internal stack traces and Prisma errors in production to avoid leaking database structures.
4. **Health & Readiness Probes**:
   - `GET /health`: Sub-millisecond container liveness check for orchestrators.
   - `GET /health/ready`: Deep dependency readiness probe checking PostgreSQL and Redis.
5. **Frontend Code-Splitting**: Full `React.lazy()` and `Suspense` route splitting. Initial bundle reduced by ~90% (from 1,225 kB down to 135 kB).
6. **Graceful Worker Shutdown**: Handles SIGTERM/SIGINT by draining BullMQ evaluation workers and stopping expired attempts intervals before disconnecting Prisma.

---

## 🐳 Phase 15: Production Docker, Nginx & AWS Deployment

### 1. Production Docker Compose
Launch the complete containerized stack (Frontend Nginx, Backend API, Redis 7, and PostgreSQL 16) with isolated internal networks:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. High-Concurrency Load Test Benchmark
Execute repeatable load tests simulating 100 concurrent students:
```bash
node server/src/scripts/loadTest.js
```
**Measured Benchmark Performance (1,000 requests @ 100 virtual students):**
- **Throughput:** 385.06 requests/second
- **Error Rate:** 0.00% (0 errors)
- **Median Latency (p50):** 201.23 ms
- **95th Percentile (p95):** 436.20 ms

### 3. Database Backup & Restore Drill
```bash
# Automated backup procedure:
node server/src/scripts/backupDatabase.js
```

### 4. Continuous Integration & Delivery (CI/CD)
The `.github/workflows/ci-cd.yml` pipeline automatically validates:
- Prisma schema integrity (`prisma validate`)
- Backend unit and integration test suites
- Frontend production bundle build (`vite build`)
- Multi-stage Docker image builds





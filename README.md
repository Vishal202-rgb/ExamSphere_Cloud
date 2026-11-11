# ExamSphere – Cloud-Based Online Examination & Assessment Platform

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/architecture-Modular%20Monolith-indigo.svg)
![Security](https://img.shields.io/badge/security-Multi--Admin%20%26%20RBAC-emerald.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)

**ExamSphere** is an enterprise-grade, cloud-native online examination and automated assessment platform designed to deliver secure, cheat-resistant, and high-concurrency exams. Built with a modular monolith architecture, it supports fine-grained Role-Based Access Control (RBAC), multi-level administration (Super Admin & Department Admin), cryptographic single-use invitation onboarding, timed exam sessions, real-time proctoring telemetry, automated objective grading, and resilient background job processing.

---

## 🏗️ Architecture & Core Principles

- **Single Source of Truth**: PostgreSQL 16 (via Prisma ORM) is the single authoritative source of truth for all users, departments, courses, exams, attempts, results, and audit trails.
- **Multi-Level Administration**:
  - **Super Admin**: Platform-wide governance, department provisioning, Super Admin invitations/promotions with step-up verification, and system telemetry.
  - **Department Admin**: Scoped strictly to their assigned academic department for course, faculty, student, and invitation management.
  - **Faculty**: Manages assigned courses, question banks, scheduled exams, live monitoring, and manual subjective grading.
  - **Student**: Enrolled candidate; accesses scheduled exams, synchronized timer sessions, and published transcripts.
- **Dual Onboarding Workflows**:
  - **Direct Administrator Provisioning**: Admins provision accounts without insecure default passwords by issuing secure, single-use activation links via email.
  - **Cryptographic Email Invitations**: 32-byte single-use random tokens stored only as SHA-256 hashes, with configurable expiration windows (48 hours) and atomic user registration.
- **Demo Account Isolation**: Demo accounts (`isDemo: true`) are flagged at the database level and public quick-fill credential buttons are strictly disabled in production builds.
- **Server-Authoritative Timer**: Examination time is computed strictly on the backend (`expiresAt - currentServerTime`). The frontend periodically synchronizes with the server, preventing device clock tampering or local refresh exploits.
- **Debounced Autosave with Optimistic Concurrency**: Candidate responses are automatically debounced on the client, version-checked on the server to reject stale out-of-order writes, and atomically upserted into PostgreSQL.
- **Auditing & Data Safety**: All sensitive actions (role elevation, invitations, account deactivations, course/faculty reassignments) are recorded in the `audit_logs` table. User deletions use soft-deletion (`deletedAt`) to preserve historical academic integrity.

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
| **PostgreSQL** | 16 | Relational database engine |
| **Prisma ORM** | 6.x | Type-safe query builder, dual Linux/Windows binary targets |
| **Redis** | 7 | In-memory cache, session store, and BullMQ transport |
| **BullMQ** | 5.x | Distributed background job queue for async evaluation |
| **Nodemailer** | 10.x | Production SMTP email delivery with local development logger |
| **Socket.IO** | 4.8.x | Real-time bi-directional telemetry and proctoring |
| **JWT & bcryptjs** | Latest | Secure token authentication (12 salt rounds) |
| **Zod** | 3.24.x | Runtime schema validation |

---

## 🛡️ Role-Based Access Control (RBAC) Matrix

| Feature / Domain | SUPER_ADMIN | DEPARTMENT_ADMIN | FACULTY | STUDENT |
| :--- | :---: | :---: | :---: | :---: |
| Platform Analytics & Global Dashboard | ✅ | ❌ | ❌ | ❌ |
| Super Admin Promotion / Demotion / Suspension | ✅ | ❌ | ❌ | ❌ |
| Create / Delete Academic Departments | ✅ | ❌ | ❌ | ❌ |
| Provision Department Administrators | ✅ | ❌ | ❌ | ❌ |
| Department-Scoped Course CRUD | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| Provision Faculty & Students (Direct / Invite) | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| CSV Bulk Import & Export of Students | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| Account Deactivation / Activation Control | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| Question Bank & Exam Authoring/Publishing | ✅ | ✅ (Own Dept) | ✅ (Assigned) | ❌ |
| Live Exam Monitoring & Manual Evaluation | ✅ | ✅ (Own Dept) | ✅ (Assigned) | ❌ |
| Start, Resume & Submit Timed Examination | ❌ | ❌ | ❌ | ✅ |
| View Personal Published Exam Results & Ranks | ❌ | ❌ | ❌ | ✅ |

---

## 🔑 Unified Single Login Page & Portal Redirection

ExamSphere features a **single, unified login page** located at `/login` for all platform roles:
- **No separate login URLs** for admins, faculty, or students.
- Users authenticate using their registered `email` and `password`.
- Upon successful authentication, the frontend dynamically inspects the cryptographically verified JWT payload and redirects users to their authorized workspace:
  - `SUPER_ADMIN` ➔ `/admin` (Global institutional control)
  - `DEPARTMENT_ADMIN` ➔ `/admin` (Scoped to assigned department)
  - `ADMIN` (Legacy Admin) ➔ `/admin` (Preserved backward compatibility)
  - `FACULTY` ➔ `/faculty` (Question banks, course exams, grading)
  - `STUDENT` ➔ `/student` (Assessments, active attempts, published transcripts)

### Demo Account Handling & Transition Sequence
- **Development Mode (`NODE_ENV=development`)**: Quick-fill demo presets (`admin@examsphere.io`, `alan.turing@examsphere.io`, `john.doe@examsphere.io`) are available on `/login` to facilitate developer testing and evaluation without having to copy-paste passwords.
- **Production Mode (`NODE_ENV=production`)**: Public demo quick-fill presets are automatically disabled on production builds (`import.meta.env.PROD` check). To temporarily enable demo buttons in a staging environment, set `VITE_ENABLE_DEMO_ACCOUNTS=true` in `.env`.
- **Existing Admin Preservation**: Legacy `ADMIN` accounts retain full administrative privileges until real Super Admin accounts are bootstrapped and verified. Existing demo records in PostgreSQL are tagged with `isDemo: true` and are never deleted.

---

## 🚀 Setup & First-Time Super Admin Bootstrap

### 1. Environment Configuration

Copy `.env.example` to `.env` in both the root and `server/` directories:
```bash
cp .env.example .env
```

Key environment variables:
```ini
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database & Cache
DATABASE_URL="postgresql://user:password@localhost:5432/examsphere"
REDIS_URL="redis://localhost:6379"

# Security & Tokens
JWT_SECRET=your_strong_jwt_access_secret_key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your_strong_jwt_refresh_secret_key
REFRESH_TOKEN_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

# Email Transport (SMTP)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=your_smtp_password
SMTP_FROM="ExamSphere <noreply@examsphere.io>"
SMTP_SECURE=false

# First-Time Super Admin Bootstrap
BOOTSTRAP_TOKEN=your_secure_bootstrap_secret_token
INITIAL_SUPERADMIN_NAME="Chief Administrator"
INITIAL_SUPERADMIN_EMAIL="superadmin@institution.edu"
INITIAL_SUPERADMIN_PASSWORD="YourStrongPassword@2026"
```

### 2. Database Migrations

Apply database schema migrations non-destructively:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3. Initial Super Admin Bootstrap (One-Time Setup)

When deploying a fresh instance, create the first Super Admin via the secure CLI command:
```bash
node server/src/scripts/bootstrapSuperAdmin.js --name "System Administrator" --email "superadmin@institution.edu" --password "StrongPass@2026"
```
*Note: Once the first active Super Admin is established, the bootstrap command is automatically and permanently disabled in the backend.*

---

## 👥 Onboarding & User Management Workflows

### 1. Multi-Super Admin Management
- **List Super Admins:** `GET /api/v1/admin/super-admins`
- **Promote User to Super Admin:** `POST /api/v1/admin/super-admins/promote` (Requires active Super Admin's password confirmation).
- **Demote Super Admin:** `POST /api/v1/admin/super-admins/demote` (Protected by the **Last Active Super Admin Guard**; rejects if only 1 active Super Admin remains).
- **Suspend Super Admin:** `PATCH /api/v1/admin/super-admins/:id/status` (Protected by the Last Active Super Admin Guard).

### 2. Department Admin Provisioning
Only Super Admins can create Department Admins:
```bash
POST /api/v1/users/department-admins
{
  "name": "Prof. Alan Turing",
  "email": "alan.turing@cse.institution.edu",
  "departmentId": "<department-uuid>",
  "employeeId": "EMP-CSE-001",
  "designation": "Head of Department"
}
```
*An activation email with a single-use password setup link is dispatched automatically.*

### 3. Email Invitation System
Authorized Admins can issue single-use cryptographic email invitations:
```bash
POST /api/v1/invitations
{
  "name": "Dr. Grace Hopper",
  "email": "grace.hopper@institution.edu",
  "role": "FACULTY",
  "departmentId": "<department-uuid>",
  "employeeId": "FAC-042",
  "designation": "Associate Professor",
  "assignedCourses": ["<course-uuid-1>", "<course-uuid-2>"]
}
```
**Invitation Lifecycle:**
1. A 32-byte cryptographic token is generated; its SHA-256 hash is stored in the `invitations` table with status `PENDING` (48-hour expiration).
2. The user receives an activation link: `https://platform.domain/accept-invitation?token=<token>`.
3. The frontend validates token health via `GET /api/v1/invitations/verify?token=<token>`.
4. The user sets their password via `POST /api/v1/invitations/accept`.
5. An atomic database transaction creates the `User` record, binds course enrollments/assignments, marks the token as `ACCEPTED`, and logs the audit event.

---

## 🔌 API Endpoints Summary

### Authentication & Bootstrap (`/api/v1/auth`)
- `POST /api/v1/auth/login` - Authenticate user, issue JWT access token & HttpOnly refresh token
- `POST /api/v1/auth/logout` - Invalidate session, revoke refresh token, clear cookies
- `POST /api/v1/auth/refresh` - Rotate refresh token and issue new access token
- `POST /api/v1/auth/bootstrap` - One-time initial Super Admin bootstrap (disabled once initialized)
- `POST /api/v1/auth/forgot-password` - Request crypto reset token for account
- `POST /api/v1/auth/reset-password` - Validate token and update account password
- `GET  /api/v1/auth/me` - Retrieve current user profile and verified role

### Super Admin Governance (`/api/v1/admin`)
- `GET   /api/v1/admin/stats` - Platform KPIs, department statistics, and audit activity
- `GET   /api/v1/admin/super-admins` - List all Super Admin accounts
- `POST  /api/v1/admin/super-admins/promote` - Promote existing user to Super Admin (password verified)
- `POST  /api/v1/admin/super-admins/demote` - Demote Super Admin (last-admin protected)
- `PATCH /api/v1/admin/super-admins/:id/status` - Suspend or reactivate Super Admin account
- `POST  /api/v1/admin/super-admins/verify-action` - Step-up password verification endpoint

### Invitation Management (`/api/v1/invitations`)
- `POST  /api/v1/invitations` - Create and dispatch single-use hashed email invitation
- `GET   /api/v1/invitations` - List invitations with role, status, and department filtering
- `PATCH /api/v1/invitations/:id/revoke` - Revoke pending invitation
- `GET   /api/v1/invitations/verify` - Public: Verify invitation token validity
- `POST  /api/v1/invitations/accept` - Public: Set password, activate account, and consume token

### User Cohorts (`/api/v1/users`)
- `GET   /api/v1/users` - Search users by role, department, active status (department-scoped)
- `POST  /api/v1/users/department-admins` - Provision Department Admin (Super Admin only)
- `POST  /api/v1/users/faculty` - Provision faculty account with course assignments
- `POST  /api/v1/users/students` - Register student with roll number, batch, section & courses
- `PATCH /api/v1/users/:id/status` - Activate or deactivate user (last Super Admin protected)
- `POST  /api/v1/users/students/bulk-import` - Atomic bulk CSV student import with duplicate validation
- `GET   /api/v1/users/students/export` - Export student records as CSV download

### Departments & Curricula (`/api/v1/departments`, `/api/v1/courses`)
- `GET    /api/v1/departments` - List departments
- `POST   /api/v1/departments` - Register new department (Super Admin only)
- `PUT    /api/v1/departments/:id` - Update department (Super Admin or assigned Dept Admin)
- `DELETE /api/v1/departments/:id` - Delete/deactivate department (Super Admin only)
- `GET    /api/v1/courses` - List courses (scoped by department for Dept Admins)
- `POST   /api/v1/courses` - Register course within authorized department
- `PUT    /api/v1/courses/:id` - Update course metadata
- `DELETE /api/v1/courses/:id` - Delete or soft-deactivate course
- `POST   /api/v1/courses/:id/faculty` - Assign faculty instructor and coordinator status
- `DELETE /api/v1/courses/:id/faculty/:facultyId` - Unassign instructor from course

---

## 🔒 Security & Data Safety Features

1. **Step-Up Verification**: Sensitive role changes require the performing Super Admin to re-enter their current password, guarding against session hijacking.
2. **Last Active Super Admin Guard**: The system calculates the count of active, un-deleted Super Admins prior to any demotion or suspension; requests reducing the active count below 1 are strictly rejected with HTTP 403.
3. **Department Isolation**: Department Admins are constrained to their assigned `departmentId` across user creation, course management, student bulk import, and invitation issuance.
4. **Hashed Token Storage**: Invitation and password reset tokens are generated using `crypto.randomBytes(32)` and stored solely as SHA-256 hashes. Leaked database snapshots cannot be used to hijack accounts.
5. **No Plaintext Passwords in Emails**: Onboarding links require users to establish their own passwords through an encrypted HTTPS setup portal.
6. **Soft Deletion for Academic Records**: Deleting a student or faculty account sets `deletedAt` and `isActive: false`, ensuring exam submissions, attempt logs, and published transcripts remain preserved for institutional compliance.
7. **Database Backup Drill**: Automated database backup script available in `server/src/scripts/backupDatabase.js`.

---

## 🧪 Testing & Verification

Run automated test suites covering authentication, onboarding, RBAC, and examination modules:
```bash
# Run all server integration and security test suites:
npm --prefix server test
```
- Batch 3: Examination Engine & Session Interface (18 tests)
- Batch 4: Evaluation, Result Management & Monitoring (14 tests)
- Batch 5: Analytics, Coding Assessment & Proctoring (11 tests)
- Batch 6: Multi-Admin, Invitations & Scoped RBAC Tests (13 tests)
- **Total:** 55 passing automated integration tests

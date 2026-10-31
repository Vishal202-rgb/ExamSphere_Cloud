# ExamSphere – Cloud-Based Online Examination & Assessment Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/architecture-Modular%20Monolith-indigo.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)

**ExamSphere** is an enterprise-grade, cloud-native online examination and automated assessment platform designed to deliver secure, cheat-resistant, and high-concurrency exams. Built with a modular monolith architecture, it supports fine-grained Role-Based Access Control (RBAC), timed exam sessions, real-time proctoring telemetry, automated objective grading, and resilient background job processing.

---

## 🏗️ Architecture & Design Principles

- **Modular Monolith**: Organized cleanly into feature modules (`auth`, `users`, `exams`, `submissions`, `health`) with strict boundaries.
- **Service & Repository Patterns**: Controllers strictly orchestrate HTTP requests/responses, delegating business logic to Services, while database interactions are encapsulated inside Repositories via Prisma ORM.
- **Role-Based Access Control (RBAC)**: Enforces principle of least privilege with distinct roles:
  1. `ADMIN`: Full platform oversight, user management, and security audit logs.
  2. `FACULTY`: Exam creation, question bank curation, live monitoring, and manual grading.
  3. `STUDENT`: Timed exam attempts, answer submissions, and result performance viewing.
- **Fail-Fast Environment Validation**: Powered by Zod schemas at application bootstrap.
- **Centralized Error Handling**: Standardized operational error envelope (`ApiError`) and global middleware.

---

## 💻 Technology Stack

### Frontend (`client/`)
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | 19.x | Modern UI rendering with Concurrent Mode |
| **Vite** | 8.x | High-speed frontend build and dev server |
| **Tailwind CSS** | 3.4.x | Utility-first styling with modern dark theme |
| **Redux Toolkit** | 2.x | Centralized client-side state management |
| **React Router** | 7.x | Declarative client-side routing |
| **Axios** | 1.x | Promise-based HTTP client with interceptors |
| **Lucide React** | Latest | Consistent modern icons |

### Backend (`server/`)
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | 20.x | High-performance asynchronous runtime |
| **Express.js** | 4.21.x | REST API web framework |
| **PostgreSQL** | 16 | Relational database engine |
| **Prisma ORM** | 6.x | Type-safe query builder and database migrations |
| **Redis** | 7 | In-memory cache, session store, and BullMQ transport |
| **BullMQ** | 5.x | Distributed background job queue |
| **Socket.IO** | 4.8.x | Real-time bi-directional telemetry and proctoring |
| **JWT & bcryptjs** | Latest | Secure token authentication and password hashing |
| **Zod** | 3.24.x | Runtime schema validation |

### DevOps & Infrastructure
- **Docker & Docker Compose**: Automated multi-container orchestration for PostgreSQL and Redis.
- **GitHub Actions**: Continuous Integration pipeline (linting, build verification, migration checks).
- **Nginx & AWS**: Production reverse proxy and cloud deployment targets.

---

## 📁 Project Directory Structure

```text
LogicHub/
├── .env.example                     # Global environment template
├── .gitignore                       # Multi-tier git exclusion rules
├── docker-compose.yml               # PostgreSQL 16 & Redis 7 orchestration
├── package.json                     # Root workspace scripts
├── README.md                        # Project documentation
│
├── client/                          # React + Vite Frontend
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── assets/                  # Images and static media
│   │   ├── components/              # Shared UI components
│   │   ├── features/                # Feature-based pages and modules
│   │   ├── lib/                     # Utilities (cn helper, etc.)
│   │   ├── services/                # Axios instance and API client
│   │   ├── store/                   # Redux Toolkit store and slices
│   │   ├── App.jsx                  # Main application dashboard
│   │   ├── index.css                # Tailwind directives & design tokens
│   │   └── main.jsx                 # React root bootstrap
│   ├── .env.example                 # Client environment template
│   ├── index.html                   # HTML entry point with metadata
│   ├── package.json                 # Frontend dependencies
│   ├── postcss.config.js            # PostCSS configuration
│   ├── tailwind.config.js           # Tailwind configuration
│   └── vite.config.js               # Vite build configuration with alias '@'
│
└── server/                          # Node.js + Express Backend
    ├── prisma/
    │   └── schema.prisma            # PostgreSQL relational schema
    ├── src/
    │   ├── config/                  # Prisma, Redis, Env & Logger configs
    │   │   ├── db.js                # Prisma client & health checker
    │   │   ├── env.js               # Zod-validated environment config
    │   │   └── redis.js             # ioredis client & health checker
    │   ├── constants/               # Roles and HTTP status codes
    │   │   ├── httpStatusCodes.js
    │   │   └── roles.js             # ADMIN, FACULTY, STUDENT
    │   ├── middlewares/             # Security, auth, RBAC & error handlers
    │   │   ├── auth.middleware.js
    │   │   ├── errorHandler.middleware.js
    │   │   ├── notFound.middleware.js
    │   │   ├── rbac.middleware.js
    │   │   └── validate.middleware.js
    │   ├── modules/                 # Feature modules (Feature-based structure)
    │   │   └── health/              # System health & diagnostic routes
    │   ├── scripts/                 # Standalone maintenance & verification
    │   │   └── testConnection.js    # PostgreSQL & Redis connectivity test
    │   ├── utils/                   # Standardized ApiResponse & ApiError
    │   ├── app.js                   # Express application setup
    │   └── server.js                # HTTP server & Socket.IO initialization
    ├── .env                         # Server environment configuration
    ├── .env.example                 # Server environment template
    └── package.json                 # Backend dependencies & Prisma scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or later
- **npm**: v10.x or later
- **Docker Desktop** (or native PostgreSQL 16 & Redis 7)
- **Git**

### 2. Start PostgreSQL & Redis via Docker
From the project root:
```bash
docker compose up -d
```
*Note: Make sure Docker Desktop is running on your machine.*

### 3. Generate Prisma Client & Run Migrations
```bash
npm run prisma:generate
```
When your PostgreSQL database is reachable:
```bash
npm run prisma:migrate
```

### 4. Verify Infrastructure Connectivity
Test both PostgreSQL and Redis connections directly:
```bash
npm run test:db
```

### 5. Launch Development Servers
Open two terminals or run separately:

**Backend API (Port 5000):**
```bash
npm run dev:server
```

**Frontend Client (Port 5173):**
```bash
npm run dev:client
```

Visit **http://localhost:5173** to view the live dashboard and run real-time API diagnostic tests.

---

## 🔑 Environment Variables Reference

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Backend Express listening port | `5000` |
| `NODE_ENV` | Runtime environment (`development`, `production`) | `development` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string for Prisma | `postgresql://postgres:postgrespassword@localhost:5432/examsphere_db?schema=public` |
| `REDIS_HOST` | Redis host address | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis authentication password | `redispassword` |
| `JWT_SECRET` | Secret key for signing access tokens | Configured in `.env` |
| `JWT_EXPIRES_IN` | Access token lifespan | `7d` |
| `VITE_API_BASE_URL` | Backend API base path for frontend Axios | `http://localhost:5000/api/v1` |

---

## 🛡️ Role-Based Access Control (RBAC) Matrix

| Feature / Domain | ADMIN | FACULTY | STUDENT |
| :--- | :---: | :---: | :---: |
| User Management & Role Assignment | ✅ | ❌ | ❌ |
| System Health & Audit Logs | ✅ | ❌ | ❌ |
| Exam Authoring & Question Bank | ✅ | ✅ | ❌ |
| Proctoring Monitor & Live Submissions | ✅ | ✅ | ❌ |
| Manual Evaluation & Grade Overrides | ✅ | ✅ | ❌ |
| Take Timed Examination | ❌ | ❌ | ✅ |
| View Personal Attempt Performance | ❌ | ❌ | ✅ |

---

## 📌 Phase Roadmap
- **Phase 1**: Project Initialization & Environment Setup (Completed)
- **Phase 2**: Authentication, JWT & RBAC Authorization Pipeline
- **Phase 3**: User Management & Profile Services
- **Phase 4**: Exam Creation & Question Bank Management
- **Phase 5**: Timed Examination Engine & Proctoring Telemetry
- **Phase 6**: Automated Evaluation & BullMQ Result Processing
- **Phase 7-15**: Advanced Analytics, Dockerization, Cloud Deployment & CI/CD

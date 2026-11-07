# ==============================================================================
# ExamSphere – Backend Production Dockerfile
# Multi-stage build, minimal Alpine footprint, and non-root unprivileged runtime
# ==============================================================================

# Stage 1: Build & Prisma Client Generation
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL required by Prisma engine
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed for prisma generate)
RUN npm ci

# Dummy database URL for build-time Prisma Client generation
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_db"

# Generate Prisma Client
RUN npx prisma generate

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL and curl for health check
RUN apk add --no-cache openssl curl

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Copy application source code
COPY src ./src

# Create and switch to non-root runtime user
USER node

# Expose HTTP port
EXPOSE 5000

# Container healthcheck against /health liveness probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Launch application server
CMD ["node", "src/server.js"]

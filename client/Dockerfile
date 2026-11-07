# ==============================================================================
# ExamSphere – Frontend Production Dockerfile
# Multi-stage build with Vite builder and lightweight Nginx Alpine server
# ==============================================================================

# Stage 1: Build static bundle
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=optional

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Serve static bundle via Nginx Alpine
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy customized Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

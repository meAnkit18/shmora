# syntax=docker/dockerfile:1
# Backend image. Build context MUST be the repo root so `shared/` is available
# (the backend imports it by relative path). From the repo root:
#   docker build -f backend/Dockerfile -t shmora-backend .

# ---- builder: install deps, then bundle backend + shared into one JS file ----
FROM node:22-alpine AS builder
WORKDIR /app
# Dependencies first for better layer caching.
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm install -g npm@11 && cd backend && npm ci
# Source. `shared/` is bundled in by esbuild (resolves the .js imports to .ts).
COPY shared ./shared
COPY backend ./backend
RUN cd backend && npm run build          # -> /app/backend/dist/index.js

# ---- runtime: only production deps + the bundle ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm install -g npm@11 && npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/backend/dist ./dist
EXPOSE 3001
# node:alpine ships busybox wget; hit the existing /health route.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/index.js"]

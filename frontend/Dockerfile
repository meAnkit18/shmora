# syntax=docker/dockerfile:1
# Frontend image. Build context MUST be the repo root so the @shared alias
# resolves. VITE_SERVER_URL is baked in at build time (Vite inlines env), so
# pass it for your target: --build-arg VITE_SERVER_URL=https://api.example.com
#   docker build -f frontend/Dockerfile --build-arg VITE_SERVER_URL=... -t shmora-frontend .

# ---- builder: install deps, then produce the static bundle ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY shared ./shared
COPY frontend ./frontend
ARG VITE_SERVER_URL=http://localhost:3001
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN cd frontend && npm run build         # -> /app/frontend/dist

# ---- runtime: nginx serving the SPA ----
FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

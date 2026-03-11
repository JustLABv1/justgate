# Monolithic Dockerfile – builds and runs both backend and frontend in one image.
# Build with:  docker build -t just-gate:latest .
# Run with:    docker run -p 3000:3000 -p 9090:9090 \
#                -e NEXTAUTH_SECRET=<secret> \
#                -e JUST_GATE_BACKEND_JWT_SECRET=<secret> \
#                just-gate:latest

# ── Build: Backend ────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS backend-builder
RUN apk upgrade --no-cache \
 && (apk del --no-cache py3-setuptools py3-setuptools-pyc py3-pip || true)
WORKDIR /build

COPY services/backend/go.mod services/backend/go.sum ./
RUN go mod download

COPY services/backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /bin/just-gate-backend \
    ./cmd/server

# ── Build: Frontend ───────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
RUN apk upgrade --no-cache \
 && (apk del --no-cache py3-setuptools py3-setuptools-pyc py3-pip || true) \
 && corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /build

COPY services/frontend/package.json \
     services/frontend/pnpm-lock.yaml \
     services/frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY services/frontend/ .
RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-alpine

RUN apk upgrade --no-cache \
 && (apk del --no-cache py3-setuptools py3-setuptools-pyc py3-pip || true) \
 && apk add --no-cache ca-certificates tzdata supervisor \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Backend binary
COPY --from=backend-builder /bin/just-gate-backend /usr/local/bin/just-gate-backend

# Frontend standalone bundle
WORKDIR /app
COPY --from=frontend-builder /build/public ./public
COPY --from=frontend-builder --chown=nextjs:nodejs /build/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /build/.next/static ./.next/static

# Supervisor config
COPY deploy/supervisord.conf /etc/supervisord.conf

# Data directory for SQLite (override JUST_GATE_DATABASE_URL for PostgreSQL)
RUN mkdir -p /data && chown nobody:nobody /data
VOLUME ["/data"]

# In monolithic mode the frontend talks to the backend on localhost
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV JUST_GATE_BACKEND_URL="http://localhost:9090"

EXPOSE 9090 3000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisord.conf"]

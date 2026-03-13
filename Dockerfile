# Monolithic Dockerfile – builds and runs both backend and frontend in one image.
# Build with:  docker build -t just-gate:latest .
# Run with:    docker run -p 3000:3000 -p 9090:9090 \
#                -e NEXTAUTH_SECRET=<secret> \
#                -e JUST_GATE_BACKEND_JWT_SECRET=<secret> \
#                just-gate:latest

# ── Build: Backend ────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/go:latest-dev AS backend-builder
WORKDIR /build

COPY services/backend/go.mod services/backend/go.sum ./
RUN go mod download

COPY services/backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /bin/justgate-backend \
    ./cmd/server

# ── Build: Frontend ───────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev AS frontend-builder
USER root
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /build

COPY services/frontend/package.json \
     services/frontend/pnpm-lock.yaml \
     services/frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY services/frontend/ .
RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev

USER root
RUN apk add --no-cache ca-certificates tzdata supervisor

# Backend binary
COPY --from=backend-builder /bin/justgate-backend /usr/local/bin/justgate-backend

# Frontend standalone bundle
WORKDIR /app
COPY --from=frontend-builder /build/public ./public
COPY --from=frontend-builder --chown=65532:65532 /build/.next/standalone ./
COPY --from=frontend-builder --chown=65532:65532 /build/.next/static ./.next/static

# Supervisor config
COPY deploy/supervisord.conf /etc/supervisord.conf

# Data directory for SQLite (override JUST_GATE_DATABASE_URL for PostgreSQL)
RUN mkdir -p /data && chown 65532:65532 /data
VOLUME ["/data"]

# In monolithic mode the frontend talks to the backend on localhost.
# Both PORT and BACKEND_PORT can be overridden at runtime; if you change
# BACKEND_PORT you must also override JUST_GATE_BACKEND_URL accordingly
# (the compose files do this automatically via variable substitution).
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV BACKEND_PORT=9090
ENV JUST_GATE_BACKEND_URL="http://localhost:${BACKEND_PORT}"

# Use the numeric UID (65532) instead of the symbolic name "nonroot" so that
# runtimes which resolve usernames against /etc/passwd don't fail on minimal
# or cross-architecture Chainguard image variants.
USER 65532:65532

EXPOSE 9090 3000

ENTRYPOINT []
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisord.conf"]
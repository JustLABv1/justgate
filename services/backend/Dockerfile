# ── Build stage ──────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/go:latest-dev AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /bin/justgate-backend \
    ./cmd/server

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /bin/justgate-backend /usr/local/bin/justgate-backend

# Data directory for SQLite (mount a volume here or use PostgreSQL in production)
VOLUME ["/data"]

# Default port – override with BACKEND_PORT at runtime.
ENV BACKEND_PORT=9090
EXPOSE 9090

ENTRYPOINT ["justgate-backend"]
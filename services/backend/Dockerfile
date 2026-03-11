# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder
RUN apk upgrade --no-cache

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /bin/just-gate-backend \
    ./cmd/server

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /bin/just-gate-backend /usr/local/bin/just-gate-backend

# Data directory for SQLite (mount a volume here or use PostgreSQL in production)
VOLUME ["/data"]

EXPOSE 9090

ENTRYPOINT ["just-gate-backend"]

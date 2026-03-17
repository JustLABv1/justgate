# Quick Start

This page covers running JustGate locally for development, as a single Docker container, and with Docker Compose. For production Kubernetes deployments, see [Deployment](Deployment).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Go | ≥ 1.22 |
| Node.js | ≥ 22 |
| pnpm | ≥ 9 |
| Docker | ≥ 24 *(for container builds)* |

---

## Local Development

### 1. Backend

```bash
cd services/backend

# SQLite is used automatically when JUST_GATE_DATABASE_URL is unset
JUST_GATE_BACKEND_JWT_SECRET=dev-secret \
go run ./cmd/server
# → http://localhost:9090
```

### 2. Frontend

```bash
cd services/frontend
pnpm install

# Create a local env file
cat > .env.local <<'EOF'
NEXTAUTH_SECRET=dev-secret
NEXTAUTH_URL=http://localhost:3000
JUST_GATE_BACKEND_URL=http://localhost:9090
JUST_GATE_BACKEND_JWT_SECRET=dev-secret
JUST_GATE_LOCAL_ACCOUNTS_ENABLED=true
JUST_GATE_LOCAL_REGISTRATION_ENABLED=true
EOF

pnpm dev
# → http://localhost:3000
```

Open `http://localhost:3000`. On the first run you are redirected to the **setup wizard** at `/setup`, where you create the first admin account and optionally configure OIDC. No additional env vars are needed for those steps.

> For the full list of environment variables, see [Configuration](Configuration).

---

## Docker (single container)

JustGate ships as a monolithic image that bundles the Go backend and Next.js frontend behind [Supervisord](http://supervisord.org/), served through Nginx.

```bash
# Build from the repo root
docker build -t justgate:latest .

docker run -d \
  -p 3000:3000 -p 9090:9090 \
  -v justgate-data:/data \
  -e NEXTAUTH_SECRET=change-me \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e JUST_GATE_BACKEND_JWT_SECRET=change-me \
  --name justgate \
  justgate:latest
```

The admin UI is available at `http://localhost:3000`. The backend API listens on port `9090`.

---

## Docker Compose

### SQLite (default, zero-config)

Use the included compose file:

```bash
docker compose -f deploy/docker-compose/docker-compose.sqlite.yml up -d
```

Or write your own:

```yaml
# docker-compose.yml
services:
  justgate:
    image: ghcr.io/justlabv1/justgate:latest
    ports:
      - "3000:3000"
      - "9090:9090"
    volumes:
      - justgate-data:/data
    environment:
      NEXTAUTH_SECRET: change-me
      NEXTAUTH_URL: http://localhost:3000
      JUST_GATE_BACKEND_JWT_SECRET: change-me

volumes:
  justgate-data:
```

```bash
docker compose up -d
```

### PostgreSQL

```bash
docker compose -f deploy/docker-compose/docker-compose.postgres.yml up -d
```

Or write your own:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: justgate
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: justgate
    volumes:
      - pg-data:/var/lib/postgresql/data

  justgate:
    image: ghcr.io/justlabv1/justgate:latest
    ports:
      - "3000:3000"
      - "9090:9090"
    environment:
      NEXTAUTH_SECRET: change-me
      NEXTAUTH_URL: http://localhost:3000
      JUST_GATE_BACKEND_JWT_SECRET: change-me
      JUST_GATE_DATABASE_URL: postgresql://justgate:change-me@postgres:5432/justgate
    depends_on:
      - postgres

volumes:
  pg-data:
```

```bash
docker compose up -d
```

---

## First Login

Once the stack is running:

1. Open the admin UI (`http://localhost:3000` by default).
2. Click **Register** and create your admin account.
3. To enable the **Platform Admin** role on that account, see [Platform Admin — Bootstrap](Platform-Admin#bootstrap-the-first-admin).

---

## Next Steps

| Goal | Guide |
|------|-------|
| Configure environment variables | [Configuration](Configuration) |
| Deploy to Kubernetes with Helm | [Deployment](Deployment) |
| Set up OIDC / SSO | [OIDC / Single Sign-On](OIDC-Single-Sign-On) |
| Protect an internal service | [Protected Apps](Protected-Apps) |
| Understand traffic analytics | [Observability](Observability) |

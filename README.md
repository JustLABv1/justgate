<div align="center">

# JustGate

**Multi-tenant proxy gateway with an admin UI**

Route authenticated bearer tokens to upstream services, inject tenant identity headers, and audit every request — all managed through a self-hosted web interface.

[![License](https://img.shields.io/badge/license-BSL%201.1-blue)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go)](services/backend/go.mod)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](services/frontend/package.json)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Docker (single container)](#docker-single-container)
  - [Docker Compose](#docker-compose)
- [Configuration](#configuration)
  - [Backend Environment](#backend-environment)
  - [Frontend Environment](#frontend-environment)
- [Deployment](#deployment)
  - [Kubernetes / Helm](#kubernetes--helm)
- [API Overview](#api-overview)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

JustGate sits in front of any HTTP upstream (Grafana Mimir, Loki, Tempo, custom APIs, …) and enforces multi-tenant access control via scoped bearer tokens. An organization admin manages tenants, routes, and tokens through a web UI; remote clients authenticate with those tokens and JustGate proxies their requests to the correct upstream, injecting the configured tenant identity header automatically.

```
Client (bearer token)
    │
    ▼
┌─────────────────────────┐
│   JustGate  (/proxy/…)  │   ← validates token, resolves route & tenant
└────────────┬────────────┘
             │  X-Scope-OrgID: <tenant-id>   (or any custom header)
             ▼
     Upstream service
```

---

## Features

- **Multi-tenancy** — unlimited tenants, each with their own upstream URL and identity header value
- **Scoped tokens** — fine-grained token scopes per route; token expiry and revocation
- **Route management** — slug-based routes mapped to tenant + upstream path
- **Audit log** — every proxied request is recorded with method, status code, and upstream URL
- **Topology view** — live WebSocket-streamed map of active tenants, routes, and tokens
- **Organisation management** — multi-org support with invite links and member roles
- **Auth flexibility** — local accounts (email + password) and/or OIDC single sign-on
- **Persistence** — SQLite (zero-config) or PostgreSQL
- **Self-contained** — single Go binary for the backend; Next.js standalone bundle for the frontend

---

## Architecture

```
services/
├── backend/          Go control plane & proxy runtime
│   ├── cmd/server/   Binary entry point
│   └── internal/
│       └── service/  HTTP handlers, store, migrations, auth
└── frontend/         Next.js admin UI
    ├── app/          App Router pages & API routes
    ├── components/   UI components (HeroUI v3 / Tailwind v4)
    └── lib/          Auth helpers, backend client, type contracts
```

**Request flow (admin UI):**
1. Admin signs in via OIDC or local credentials → NextAuth session
2. Next.js API routes mint a short-lived signed JWT and forward admin calls to the Go backend
3. Go validates the JWT, authorises the operation, and persists changes

**Request flow (proxy runtime):**
1. Client sends `GET /proxy/{slug}/…` with a `Bearer <token>` header
2. Go validates token scope, expiry, and active state
3. Upstream request is forwarded with the tenant identity header injected
4. Response is streamed back; audit record is written

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Go | ≥ 1.22 |
| Node.js | ≥ 22 |
| pnpm | ≥ 9 |
| Docker | ≥ 24 *(for container builds)* |

### Local Development

**1. Backend**

```bash
cd services/backend

# SQLite is used automatically when JUST_GATE_DATABASE_URL is unset
JUST_GATE_BACKEND_JWT_SECRET=dev-secret \
go run ./cmd/server
# → http://localhost:9090
```

**2. Frontend**

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

Open `http://localhost:3000`, register the first admin account, and you're ready to go.

### Docker (single container)

```bash
# Build the monolithic image from the repo root
docker build -t just-gate:latest .

docker run -d \
  -p 3000:3000 -p 9090:9090 \
  -v just-gate-data:/data \
  -e NEXTAUTH_SECRET=change-me \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e JUST_GATE_BACKEND_JWT_SECRET=change-me \
  --name just-gate \
  just-gate:latest
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: just-gate
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: just-gate
    volumes:
      - pg-data:/var/lib/postgresql/data

  just-gate:
    image: just-gate:latest
    build: .
    ports:
      - "3000:3000"
      - "9090:9090"
    environment:
      NEXTAUTH_SECRET: change-me
      NEXTAUTH_URL: http://localhost:3000
      JUST_GATE_BACKEND_JWT_SECRET: change-me
      JUST_GATE_DATABASE_URL: postgresql://just-gate:change-me@postgres:5432/just-gate
    depends_on:
      - postgres

volumes:
  pg-data:
```

```bash
docker compose up -d
```

---

## Configuration

### Backend Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `JUST_GATE_BACKEND_JWT_SECRET` | — | *(insecure dev default)* | Secret used to sign & verify admin JWTs |
| `JUST_GATE_DATABASE_URL` | — | `sqlite://just-gate.db` | Database connection — `sqlite://<path>` or `postgresql://…` |
| `JUST_GATE_TENANT_HEADER` | — | `X-Scope-OrgID` | Header name injected into upstream requests to carry the tenant ID |
| `PORT` | — | `9090` | Backend HTTP listen port |

### Frontend Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXTAUTH_SECRET` | **Yes** | — | NextAuth.js session signing secret |
| `NEXTAUTH_URL` | **Yes** | — | Public base URL of the frontend (e.g. `https://just-gate.example.com`) |
| `JUST_GATE_BACKEND_URL` | — | `http://localhost:9090` | URL the frontend uses to reach the backend |
| `JUST_GATE_BACKEND_JWT_SECRET` | **Yes** | — | Must match the backend's JWT secret |
| `JUST_GATE_LOCAL_ACCOUNTS_ENABLED` | — | `true` | Enable email/password login |
| `JUST_GATE_LOCAL_REGISTRATION_ENABLED` | — | `true` | Allow new account self-registration |
| `JUST_GATE_OIDC_ISSUER` | — | — | OIDC issuer URL (enables SSO when set) |
| `JUST_GATE_OIDC_CLIENT_ID` | — | — | OIDC client ID |
| `JUST_GATE_OIDC_CLIENT_SECRET` | — | — | OIDC client secret |
| `JUST_GATE_OIDC_NAME` | — | `Single Sign-On` | Label shown on the sign-in button |

---

## Deployment

### Kubernetes / Helm

The Helm chart lives in `deploy/helm/just-gate` and supports two deployment modes.

**Add the Bitnami dependency and install:**

```bash
helm dependency update deploy/helm/just-gate

# Monolithic (default) — single pod, SQLite
helm install just-gate deploy/helm/just-gate \
  --set frontend.nextauthUrl=https://just-gate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)

# Microservice mode with PostgreSQL
helm install just-gate deploy/helm/just-gate \
  --set mode=microservice \
  --set postgresql.auth.password=change-me \
  --set frontend.nextauthUrl=https://just-gate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)
```

**Key Helm values:**

| Value | Default | Description |
|---|---|---|
| `mode` | `monolithic` | `monolithic` or `microservice` |
| `postgresql.enabled` | `true` | Deploy a Bitnami PostgreSQL subchart |
| `postgresql.auth.password` | — | **Required** when PostgreSQL is enabled |
| `backend.tenantHeaderName` | `X-Scope-OrgID` | Upstream tenant identity header |
| `ingress.enabled` | `false` | Enable Kubernetes Ingress |
| `persistence.size` | `1Gi` | SQLite PVC size (PostgreSQL disabled only) |

See [`deploy/helm/just-gate/values.yaml`](deploy/helm/just-gate/values.yaml) for the full reference.

---

## API Overview

All admin endpoints require a valid backend admin JWT (`Authorization: Bearer <jwt>`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |
| `POST` | `/api/v1/auth/local/register` | Register a local admin account |
| `POST` | `/api/v1/auth/local/verify` | Verify credentials and obtain a JWT |
| `GET` | `/api/v1/admin/overview` | Summary counts and status |
| `GET/POST` | `/api/v1/admin/tenants` | List / create tenants |
| `GET/PUT/DELETE` | `/api/v1/admin/tenants/{id}` | Read / update / delete a tenant |
| `GET/POST` | `/api/v1/admin/routes` | List / create routes |
| `GET/PUT/DELETE` | `/api/v1/admin/routes/{id}` | Read / update / delete a route |
| `GET/POST` | `/api/v1/admin/tokens` | List / issue tokens |
| `GET/PATCH/DELETE` | `/api/v1/admin/tokens/{id}` | Read / revoke / delete a token |
| `GET` | `/api/v1/admin/audit` | Audit log (paginated) |
| `GET` | `/api/v1/admin/topology` | Current topology snapshot |
| `GET` | `/api/v1/admin/topology/stream` | Live topology (WebSocket) |
| `GET/POST` | `/api/v1/admin/orgs` | List / create organisations |
| `ANY` | `/proxy/{slug}/…` | Authenticated proxy surface for clients |

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository and create a feature branch (`git checkout -b feat/my-feature`)
2. Make your changes and add tests where applicable
3. Run the test suite: `cd services/backend && go test ./...`
4. Ensure the frontend builds: `cd services/frontend && pnpm build`
5. Open a pull request against `main` with a clear description of the change

Please keep pull requests focused. Large refactors or new features should be discussed in an issue first.

---

## License

JustGate is released under the [Business Source License 1.1](LICENSE).

**In short:**

- **Free** for non-commercial use, internal tooling, research, and open-source projects
- **Commercial license required** for use in any product or service operated by a for-profit organisation
- The license converts to [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) on **11 March 2030**

For commercial licensing enquiries, please contact **licensing@justlab.dev**.


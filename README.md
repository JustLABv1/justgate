<div align="center">

<img src="services/frontend/public/justgate_logo.png" alt="JustGate Logo" width="80" height="80" />

# JustGate

**Multi-tenant proxy gateway with an admin UI**

Route authenticated bearer tokens to upstream services, inject tenant identity headers, enforce rate limits and IP policies, and audit every request — all managed through a self-hosted web interface.

[![License](https://img.shields.io/badge/license-BSL%201.1-blue)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go)](services/backend/go.mod)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](services/frontend/package.json)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
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
- [Platform Admin](#platform-admin)
  - [Bootstrap the first admin](#bootstrap-the-first-admin)
  - [Capabilities](#capabilities)
- [OIDC / Single Sign-On](#oidc--single-sign-on)
  - [How auto-discovery works](#how-auto-discovery-works)
  - [Issuer URL format](#issuer-url-format)
  - [Troubleshooting the 503 / 5xx discovery error](#troubleshooting-the-503--5xx-discovery-error)
  - [Option A — Helm / env vars](#option-a--helm--env-vars-static)
  - [Option B — Admin UI](#option-b--admin-ui-dynamic)
  - [Keycloak client configuration](#keycloak-client-configuration)
  - [Internal CA / self-signed certificates](#internal-ca--self-signed-certificates)
  - [OIDC org mappings](#oidc-org-mappings)
- [API Overview](#api-overview)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

JustGate sits in front of any HTTP upstream (Grafana Mimir, Loki, Tempo, custom APIs, …) and enforces multi-tenant access control via scoped bearer tokens. An organisation admin manages tenants, routes, and tokens through a web UI; remote clients authenticate with those tokens and JustGate proxies their requests to the correct upstream — injecting the configured tenant identity header, enforcing rate limits, filtering by IP, and tripping circuit breakers when the upstream is unhealthy.

```
Client (bearer token)
    │
    ▼
┌────────────────────────────────────────────────┐
│  JustGate  (/proxy/{slug}/…)                   │
│                                                │
│  1. IP allow/deny check                        │
│  2. Token validation (scope, expiry, active)   │
│  3. Rate limiting (per-route or per-token)     │
│  4. Circuit breaker                            │
│  5. Proxy  →  inject tenant identity header    │
│  6. Record audit + traffic stat                │
└────────────────────────────────────────────────┘
             │  X-Scope-OrgID: <tenant-id>
             ▼
     Upstream service
```

---

## Features

### Core proxy
- **Multi-tenancy** — unlimited tenants, each with their own upstream URL and identity header value
- **Scoped bearer tokens** — fine-grained scopes per route; expiry, revocation, and per-token rate limits
- **Slug-based routes** — stable `GET /proxy/{slug}/…` entry points mapped to tenant + upstream path
- **Method allowlisting** — restrict which HTTP methods a route accepts
- **IP allow / deny lists** — per-route CIDR allowlists and denylists (IPv4 and IPv6)
- **Rate limiting** — configurable requests-per-minute (RPM) and burst; defined at route level or token level; Redis-backed or in-memory
- **Circuit breaker** — automatically stops forwarding to unhealthy upstreams and recovers when they come back
- **Load balancing** — multiple weighted upstream URLs per tenant with primary/replica designation

### Observability
- **Audit log** — every proxied request recorded with method, status, upstream URL, and latency; paginated
- **Traffic analytics dashboard** — 5-minute bucketed request volume, error rate, and average latency charts with 24 h / prior 24 h comparison; all gateway-rejected requests (429, 403, 502) are included in the stats
- **Upstream health checks** — periodic reachability checks per tenant with history; latency tracking
- **Live topology map** — WebSocket-streamed interactive graph of tokens → routes → tenants → upstreams; edges turn red within 30 seconds of an error and clear automatically; animated packet flow on active traffic
- **Route tester** — built-in HTTP client in the admin UI with route/token selectors, auto-filled URL, `Authorization` header injection, and a live cURL command preview with one-click copy

### Administration
- **Organisation management** — multi-org support with invite links and member roles
- **Platform Admin** — superadmin role with cross-organisation visibility: manage all users, orgs, and platform admin grants
- **OIDC org mappings** — auto-assign users to organisations based on OIDC group claims
- **Auth flexibility** — local accounts (email + password) and/or OIDC single sign-on
- **Session management** — view and revoke active admin sessions

### Operations
- **Persistence** — SQLite (zero-config, default) or PostgreSQL
- **Zero-downtime schema migrations** — versioned migrations run automatically on startup
- **Single binary backend** — one Go binary, no external runtime dependencies beyond the database
- **Helm chart** — monolithic (single pod, SQLite) or microservice (split pods, PostgreSQL) deployment modes

---

## Screenshots

| Sign-in | Overview | Topology |
|---------|----------|----------|
| ![Sign-in](docs/screenshots/signin.png) | ![Overview](docs/screenshots/overview.png) | ![Topology](docs/screenshots/topology.png) |

| Routes | Audit Log | Platform Admin |
|--------|-----------|----------------|
| ![Routes](docs/screenshots/routes.png) | ![Audit](docs/screenshots/audit.png) | ![Platform Admin](docs/screenshots/platform-admin.png) |

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
2. Go checks IP allowlist/denylist, validates the token (scope, expiry, active state), enforces rate limits, and checks the circuit breaker
3. The upstream request is forwarded with the tenant identity header injected
4. Response is streamed back; an audit record and a 5-minute traffic stat bucket are written asynchronously

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

### Docker Compose

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
    image: justgate:latest
    build: .
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

## Configuration

### Backend Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `JUST_GATE_BACKEND_JWT_SECRET` | — | *(insecure dev default)* | Secret used to sign & verify admin JWTs |
| `JUST_GATE_DATABASE_URL` | — | `sqlite://justgate.db` | Database connection — `sqlite://<path>` or `postgresql://…` |
| `JUST_GATE_TENANT_HEADER` | — | `X-Scope-OrgID` | Header name injected into upstream requests to carry the tenant ID |
| `JUST_GATE_REDIS_URL` | — | — | Redis connection URL (e.g. `redis://localhost:6379`). When set, rate limiting uses Redis instead of in-memory state. Required for multi-replica deployments. |
| `JUSTGATE_INITIAL_ADMIN_EMAIL` | — | — | Email of the first platform admin. After this user signs in, they are automatically granted platform admin status (idempotent, retries for 10 min) |
| `PORT` | — | `9090` | Backend HTTP listen port |

### Frontend Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXTAUTH_SECRET` | **Yes** | — | NextAuth.js session signing secret |
| `NEXTAUTH_URL` | **Yes** | — | Public base URL of the frontend (e.g. `https://justgate.example.com`). Also used as the base URL displayed in the Route Tester. |
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

The Helm chart lives in `deploy/helm/justgate` and supports two deployment modes.

**From the OCI registry (recommended):**

```bash
# Monolithic (default) — single pod, SQLite
helm install justgate oci://ghcr.io/justlabv1/justgate --version <version> \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)

# Microservice mode with PostgreSQL
helm install justgate oci://ghcr.io/justlabv1/justgate --version <version> \
  --set mode=microservice \
  --set postgresql.auth.password=change-me \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)
```

**From source:**

```bash
helm dependency update deploy/helm/justgate

# Monolithic (default) — single pod, SQLite
helm install justgate deploy/helm/justgate \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)

# Microservice mode with PostgreSQL
helm install justgate deploy/helm/justgate \
  --set mode=microservice \
  --set postgresql.auth.password=change-me \
  --set frontend.nextauthUrl=https://justgate.example.com \
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
| `backend.initialAdminEmail` | — | Email of the first platform admin (see [Platform Admin](#platform-admin)) |
| `backend.redisUrl` | — | Redis URL for distributed rate limiting (multi-replica only) |
| `ingress.enabled` | `false` | Enable Kubernetes Ingress |
| `persistence.size` | `1Gi` | SQLite PVC size (PostgreSQL disabled only) |

See [`deploy/helm/justgate/values.yaml`](deploy/helm/justgate/values.yaml) for the full reference.

---

## Platform Admin

Platform admins are a superadmin role that sits above organisation owners. Unlike regular users who only see their own organisation's resources, platform admins have cross-organisation visibility and control through a dedicated **Platform Admin** section in the navigation.

### Bootstrap the first admin

The platform admin role is seeded via the `JUSTGATE_INITIAL_ADMIN_EMAIL` environment variable (or `backend.initialAdminEmail` in Helm). **The user must first sign in** (creating their account) before the seed takes effect — the backend retries the lookup every 15 seconds for up to 10 minutes after startup.

**Local development:**
```bash
JUSTGATE_INITIAL_ADMIN_EMAIL=you@example.com go run ./cmd/server
```

**Helm:**
```bash
helm upgrade justgate oci://ghcr.io/justlabv1/justgate \
  --set backend.initialAdminEmail=you@example.com \
  ...
```

Or in `values.yaml`:
```yaml
backend:
  initialAdminEmail: "you@example.com"
```

After the first admin is set up, additional admins can be granted (or revoked) through **Platform Admin → Platform Admins** in the UI. The seed email can be left set permanently — the grant is idempotent.

> **Sign out and sign back in** after the seed runs to get the Platform Admin section to appear in the sidebar.

### Capabilities

| Section | What you can do |
|---|---|
| **Platform Admin → All Users** | View all registered users across every organisation; delete accounts |
| **Platform Admin → All Orgs** | View all organisations with member counts; delete organisations (cascades all resources) |
| **Platform Admin → Platform Admins** | Grant or revoke the platform admin role by email |
| **Platform Admin → Settings** | Configure OIDC / SSO provider and org mappings |

---

## Route & Token Configuration

### Rate Limiting

Rate limits can be set at the **route level** (applies to all tokens using that route) or the **token level** (applies regardless of route). Route-level limits take precedence when both are configured.

| Field | Description |
|---|---|
| **Rate Limit RPM** | Maximum requests per minute. `0` disables rate limiting. |
| **Rate Limit Burst** | Maximum burst size above the steady-state rate. Defaults to RPM/10 when left at `0`. |

When a request is rejected by the rate limiter, JustGate returns `429 Too Many Requests` with a `Retry-After: 60` header. The event is recorded in both the audit log and the traffic analytics dashboard.

By default rate limit counters are stored in-memory per process. For multi-replica deployments, configure `JUST_GATE_REDIS_URL` to share counters via Redis.

### IP Allow / Deny Lists

Per-route CIDR lists control which client IPs can use a route:

| Field | Description |
|---|---|
| **Allow CIDRs** | Comma-separated CIDR list. If non-empty, only matching IPs are allowed. |
| **Deny CIDRs** | Comma-separated CIDR list. Matching IPs are rejected with `403 Forbidden`. |

Deny is checked before allow. Both IPv4 and IPv6 CIDRs are supported.

### Auth Modes

Each tenant can be configured with one of the following authentication modes:

| Mode | Description |
|---|---|
| `header` | Tenant identity is injected as a request header (default). |
| `jwt` | Tenant identity is injected as a signed JWT claim. |
| `none` | No identity header is injected; the request is forwarded as-is. |

---

## Observability

### Traffic Analytics Dashboard

The dashboard aggregates proxy traffic into 5-minute buckets and displays:

- **Request volume** over time (area chart with error overlay)
- **24 h vs prior 24 h** comparison table for requests, error rate, and average latency
- **KPI strip** — total requests, error rate, average latency, and prior-period request count

Traffic stats are recorded for every proxied request, including gateway-rejected ones (429 too many requests, 403 forbidden, 502 bad gateway). Stats are scoped to the active organisation and filtered via a tenant JOIN so multi-org deployments always see their own data.

### Live Topology Map

The topology page shows a real-time graph of your configuration:

```
[ Token ] ──── [ Route ] ──── [ Tenant ] ──── [ Upstream ]
```

- **Green nodes / edges** — healthy, reachable
- **Red nodes / edges** — errors or unreachable upstream (clears automatically after 30 s with no new errors)
- **Animated packets** — visible on edges with traffic in the last 30 seconds
- **Node inspector** — click any node to see details and available actions (edit, create connected resource)
- **Draft mode** — create routes, tokens, or tenants directly on the graph without leaving the topology view

### Route Tester

Available from the **Routes** page, the Route Tester lets you fire ad-hoc HTTP requests through the proxy:

- **Route selector** — pick a route to auto-fill the proxy URL and constrain the method dropdown to the route's allowed methods
- **Token hints** — shows compatible active tokens for the selected route's tenant
- **Auto-injected Authorization header** — paste a token secret and it is sent as `Bearer <secret>` automatically
- **Extra headers** — add arbitrary headers alongside the auto-injected auth
- **cURL preview** — live-generated `curl` command that reflects all current settings; one-click copy to clipboard

### Upstream Health

Each tenant includes optional health check configuration. JustGate periodically probes the upstream and stores:

- Current status (`up` / `down` / `unknown`)
- Latency in milliseconds
- Last-checked timestamp
- Last error message (if any)
- History of the last 10 checks

Health status is reflected in the topology map and tenant detail panel in real time.

---

## OIDC / Single Sign-On

JustGate supports OIDC-based single sign-on on top of (or instead of) local accounts. There are two ways to configure it:

| Method | When it takes effect | Suitable for |
|---|---|---|
| **Helm values** / env vars | On pod start (static) | GitOps, initial bootstrap |
| **Admin UI** (Settings → OIDC) | Immediately (stored in DB) | Runtime changes, secret rotation |

The Admin UI takes precedence over Helm/env vars when an enabled OIDC config is found in the database.

---

### How auto-discovery works

next-auth uses OIDC **Discovery** to configure itself. On startup it fetches:

```
GET <issuer>/.well-known/openid-configuration
```

The response must return **HTTP 200** with a valid JSON document. If the pod gets anything else (503, 404, connection refused, TLS error) the sign-in flow will fail immediately with `SIGNIN_OAUTH_ERROR`.

---

### Issuer URL format

The issuer URL is the most common source of errors. It must match exactly what the identity provider publishes in the discovery document.

| Provider | Issuer URL pattern |
|---|---|
| **Keycloak** | `https://<host>/realms/<realm-name>` |
| **Keycloak (legacy < 17)** | `https://<host>/auth/realms/<realm-name>` |
| **Dex** | `https://<host>/dex` |
| **Auth0** | `https://<tenant>.eu.auth0.com` |
| **Azure AD** | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| **Google** | `https://accounts.google.com` |
| **Authentik** | `https://<host>/application/o/<app-slug>/` |
| **GitLab** | `https://gitlab.com` |

> **Keycloak example:** if your realm is called `myrealm`, the issuer is  
> `https://keycloak.example.com/realms/myrealm`  
> You can verify this by opening that URL in a browser — you should see a JSON document.

---

### Troubleshooting the 503 / 5xx discovery error

The error `expected 200 OK, got: 503 Service Unavailable` means next-auth reached the server but got a failure response while fetching the discovery document. Common causes:

1. **Wrong realm / path** — the URL resolves but the realm doesn't exist or the path is wrong.  
   Verify manually: `curl -v https://<issuer>/.well-known/openid-configuration`

2. **Provider temporarily unavailable** — the IdP is overloaded or starting up.

3. **Pod cannot reach the IdP** — if the IdP is on an internal network, DNS may resolve but routing rules / NetworkPolicies may block the traffic.  
   Test from inside the cluster:  
   ```bash
   kubectl exec -it <justgate-pod> -- wget -qO- https://<issuer>/.well-known/openid-configuration
   ```

4. **Internal / self-signed CA** — the discovery request fails TLS verification (shows as `unable to get local issuer certificate`). Fix: configure `customCAs` in Helm (see below).

5. **Trailing slash mismatch** — JustGate strips a trailing slash from the issuer automatically, but the discovery URL the IdP returns in its token may include/exclude one. If you still see issues, ensure your IdP and the issuer value you supply have the same format.

---

### Option A — Helm / env vars (static)

Set these in your `values.yaml` (or via `--set`):

```yaml
frontend:
  nextauthUrl: "https://justgate.example.com"   # public URL of the app
  oidc:
    issuer: "https://keycloak.example.com/realms/myrealm"
    clientId: "justgate"
    clientSecret: "your-client-secret"
    name: "Login with Keycloak"                 # optional button label
```

Or with `--set` flags:

```bash
helm upgrade justgate oci://ghcr.io/justlabv1/justgate \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.oidc.issuer=https://keycloak.example.com/realms/myrealm \
  --set frontend.oidc.clientId=justgate \
  --set frontend.oidc.clientSecret=<secret>
```

> **Note:** `clientId` and `clientSecret` are written into a Kubernetes `Secret` automatically by the chart. You do not need to create it manually.

---

### Option B — Admin UI (dynamic)

1. Sign in as an admin and navigate to **Settings → OIDC**.
2. Toggle **Enabled**.
3. Fill in the fields:

| Field | Description |
|---|---|
| **Issuer URL** | Full issuer URL including realm (see table above). No trailing slash. |
| **Client ID** | The client/application ID registered in your IdP. |
| **Client Secret** | The client secret. Leave blank to keep the stored value. |
| **Button Label** | Text shown on the sign-in page (default: `Single Sign-On`). |
| **Groups Claim** | JWT claim containing groups/roles for org mapping (e.g. `groups` or `realm_access.roles`). Optional. |

4. Click **Save**. Changes take effect on the next request (no restart needed).

> The client secret is AES-encrypted before being written to the database.

---

### Keycloak client configuration

In Keycloak, create a new client for JustGate:

| Setting | Value |
|---|---|
| **Client type** | `OpenID Connect` |
| **Client ID** | `justgate` (or whatever you set as `clientId`) |
| **Client authentication** | `On` (confidential client) |
| **Valid redirect URIs** | `https://justgate.example.com/api/auth/callback/oidc` |
| **Web origins** | `https://justgate.example.com` |

Retrieve the client secret from the **Credentials** tab.

---

### Internal CA / self-signed certificates

If your IdP uses a certificate signed by an internal CA, mount the CA bundle via Helm:

```yaml
customCAs:
  enabled: true
  # Inline PEM — paste the full CA certificate
  certificates: |
    -----BEGIN CERTIFICATE-----
    MIIBxTCCAW+gAwIBAgIJA...
    -----END CERTIFICATE-----
```

Or reference an existing ConfigMap / Secret:

```yaml
customCAs:
  enabled: true
  existingConfigMap: my-ca-bundle   # must have a 'ca-bundle.crt' key
```

The chart automatically sets `NODE_EXTRA_CA_CERTS` for the Next.js process.

---

### OIDC org mappings

JustGate can automatically assign users to organisations based on OIDC groups/roles:

1. Set the **Groups Claim** field to the JWT claim that contains groups (e.g. `groups`).
2. In **Settings → OIDC → Org Mappings**, map OIDC group names to JustGate organisations.

When a user signs in via OIDC, JustGate reads the groups claim from the ID token and adds the user to mapped organisations automatically.

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
| `GET/POST` | `/api/v1/admin/tenants/{id}/upstreams` | List / add load-balancing upstream URLs for a tenant |
| `DELETE` | `/api/v1/admin/tenant-upstream/{upstreamID}` | Remove a tenant upstream |
| `GET` | `/api/v1/admin/health-history` | Upstream health check history |
| `GET/POST` | `/api/v1/admin/routes` | List / create routes |
| `GET/PUT/DELETE` | `/api/v1/admin/routes/{id}` | Read / update / delete a route |
| `GET/POST` | `/api/v1/admin/tokens` | List / issue tokens |
| `GET/PATCH/DELETE` | `/api/v1/admin/tokens/{id}` | Read / revoke / delete a token |
| `GET` | `/api/v1/admin/audit?page=1&pageSize=50` | Audit log (paginated) |
| `GET` | `/api/v1/admin/traffic/stats?hours=24` | Traffic stat buckets |
| `GET` | `/api/v1/admin/traffic/overview` | 24 h vs prior 24 h KPIs |
| `GET` | `/api/v1/admin/topology` | Current topology snapshot |
| `GET` | `/api/v1/admin/topology/stream` | Live topology (WebSocket) |
| `GET` | `/api/v1/admin/search?q=…` | Global search across routes, tenants, and tokens |
| `POST` | `/api/v1/admin/route-test` | Execute a test request through the proxy |
| `GET/POST` | `/api/v1/admin/orgs` | List / create organisations |
| `GET/POST` | `/api/v1/admin/sessions` | List / create admin sessions |
| `DELETE` | `/api/v1/admin/sessions/{id}` | Revoke an admin session |
| `GET` | `/api/v1/admin/platform/check` | Check caller's platform admin status |
| `GET/POST` | `/api/v1/admin/platform/admins` | List platform admins / grant by email |
| `DELETE` | `/api/v1/admin/platform/admins/{userID}` | Revoke platform admin |
| `GET` | `/api/v1/admin/platform/users` | List all users (platform admin required) |
| `DELETE` | `/api/v1/admin/platform/users/{userID}` | Delete a user account |
| `GET` | `/api/v1/admin/platform/orgs` | List all organisations (platform admin required) |
| `DELETE` | `/api/v1/admin/platform/orgs/{orgID}` | Delete an organisation (cascades) |
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

For commercial licensing enquiries, please contact **kontakt@justlab.app**.


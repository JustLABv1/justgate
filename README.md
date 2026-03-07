# just-proxy-guard

Multi-tenant proxy guard for agent and observability traffic.

The admin surface is a Next.js 16 app using HeroUI. All control-plane reads and writes flow through the Go backend. The Go backend owns persistence, validates admin identity, issues runtime proxy behavior, and records audit activity.

## Architecture

- Frontend: authenticated admin UI for tenants, routes, tokens, and audit state.
- Backend: Go control plane and `/proxy/{slug}/...` runtime surface.
- Persistence: SQLite by default, PostgreSQL when `JUST_PROXY_GUARD_DATABASE_URL` uses a Postgres DSN.
- Admin auth: NextAuth on the frontend, then a short-lived signed admin JWT passed to Go.

## Local development

Frontend:

```bash
pnpm install
pnpm dev
```

Backend:

```bash
cd proxy-backend
go run ./cmd/server
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:9090`

## Required environment

Frontend:

```bash
NEXTAUTH_SECRET=replace-me
JUST_PROXY_GUARD_BACKEND_URL=http://localhost:9090
JUST_PROXY_GUARD_BACKEND_JWT_SECRET=replace-me
```

Backend:

```bash
JUST_PROXY_GUARD_BACKEND_JWT_SECRET=replace-me
JUST_PROXY_GUARD_DATABASE_URL=sqlite://just-proxy-guard.db
MIMIR_TENANT_HEADER=X-Scope-OrgID
```

Optional OIDC configuration:

```bash
JUST_PROXY_GUARD_OIDC_ISSUER=https://issuer.example.com
JUST_PROXY_GUARD_OIDC_CLIENT_ID=client-id
JUST_PROXY_GUARD_OIDC_CLIENT_SECRET=client-secret
JUST_PROXY_GUARD_OIDC_NAME=Corporate SSO
```

Local fallback admin login:

```bash
JUST_PROXY_GUARD_DEV_ADMIN_PASSWORD=dev-admin
JUST_PROXY_GUARD_DEV_ADMIN_EMAIL=admin@local.dev
JUST_PROXY_GUARD_DEV_ADMIN_NAME=Local Admin
```

If no OIDC values are set outside production, the UI exposes the local password fallback.

## Runtime model

1. A browser admin signs in through OIDC or the local development fallback.
2. Next.js mints a short-lived backend admin JWT.
3. Go validates that JWT for every admin API call.
4. Runtime clients use bearer tokens against `/proxy/{slug}/...`.
5. Go validates tenant, route, scope, expiry, and audit state before proxying upstream.

## Validation

Verified in this repository with:

```bash
pnpm build
cd proxy-backend && go test ./...
```

Smoke-tested flows:

- admin overview read with signed admin JWT
- tenant creation
- route creation and route update
- token issuance and token revoke
- revoked token rejection on the proxy surface

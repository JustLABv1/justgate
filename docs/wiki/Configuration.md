# Configuration

Complete reference for all JustGate environment variables. For deployment-specific configuration (Helm values, Docker Compose), see [Deployment](Deployment).

---

## Backend Environment

The backend is a single Go binary. All settings are passed via environment variables.

| Variable | Required | Default | Description |
|---|---|---|---|
| `JUST_GATE_BACKEND_JWT_SECRET` | — | *(insecure dev default)* | Secret used to sign and verify admin JWTs issued by the frontend. Must match `JUST_GATE_BACKEND_JWT_SECRET` on the frontend. |
| `JUST_GATE_DATABASE_URL` | — | `sqlite://justgate.db` | Database connection string. Use `sqlite://<path>` for SQLite or `postgresql://user:pass@host/db` for PostgreSQL. |
| `JUST_GATE_TENANT_HEADER` | — | `X-Scope-OrgID` | Header name injected into upstream requests to carry the tenant ID. Change this if your upstream expects a different header (e.g. `X-Org-ID`). |
| `JUST_GATE_REDIS_URL` | — | — | Redis connection URL (e.g. `redis://localhost:6379`). When set, rate-limit counters are stored in Redis instead of in-process memory. **Required for multi-replica deployments** to share counters across pods. |
| `JUSTGATE_INITIAL_ADMIN_EMAIL` | — | — | Email address of the first platform admin. After this user signs in for the first time, they are automatically granted platform admin status. The grant is idempotent; the value can be left set permanently. The backend retries the lookup every 15 seconds for up to 10 minutes after startup. |
| `INSTANCE_ID` | — | *(hostname)* | Stable identifier for this backend instance, shown in **Overview → Instances**. Defaults to the machine hostname. In Kubernetes the Helm chart injects the pod name automatically via the Downward API. Set explicitly when running multiple instances on the same host. |
| `REGION` | — | — | Optional region or availability-zone label displayed alongside the instance in the UI (e.g. `us-east-1`, `eu-west-1`). |
| `PORT` | — | `9090` | Backend HTTP listen port. |

### Security notes

- `JUST_GATE_BACKEND_JWT_SECRET` is the root of trust for all admin operations. Use a strong random value in production (`openssl rand -hex 32`).
- SQLite stores data in a single file. Ensure the file path is on a persistent volume in container deployments.
- Never expose the backend port (`9090`) directly to the internet; it should only be reachable from the frontend or internal network.

---

## Frontend Environment

The frontend is a Next.js application. Variables are set at build time (for static values) or at runtime via the process environment.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXTAUTH_SECRET` | **Yes** | — | NextAuth.js session signing and encryption secret. Use a strong random value (`openssl rand -hex 32`). |
| `NEXTAUTH_URL` | **Yes** | — | Public base URL of the frontend (e.g. `https://justgate.example.com`). Also used as the base URL displayed in the Route Tester. Must not have a trailing slash. |
| `JUST_GATE_BACKEND_URL` | — | `http://localhost:9090` | Internal URL the frontend uses to reach the backend API. In Kubernetes this is typically the backend Service address. |
| `JUST_GATE_BACKEND_JWT_SECRET` | **Yes** | — | Must match the backend's `JUST_GATE_BACKEND_JWT_SECRET`. Used to mint short-lived admin JWTs that the frontend sends with every API call. |
| `JUST_GATE_LOCAL_ACCOUNTS_ENABLED` | — | `true` | Set to `false` to disable email/password login entirely (OIDC-only mode). |
| `JUST_GATE_LOCAL_REGISTRATION_ENABLED` | — | `true` | Set to `false` to prevent new users from self-registering. Existing accounts can still sign in. |
| `JUST_GATE_OIDC_ISSUER` | — | — | OIDC issuer URL. When set, enables SSO on the sign-in page. See [OIDC / Single Sign-On](OIDC-Single-Sign-On) for provider-specific formats. |
| `JUST_GATE_OIDC_CLIENT_ID` | — | — | OIDC client ID registered with your identity provider. |
| `JUST_GATE_OIDC_CLIENT_SECRET` | — | — | OIDC client secret. Keep this out of version control; use Kubernetes Secrets or a secrets manager. |
| `JUST_GATE_OIDC_NAME` | — | `Single Sign-On` | Label shown on the sign-in button for the OIDC provider (e.g. `Login with Keycloak`). |

> **Tip:** OIDC credentials can also be configured at runtime via **Settings → OIDC** in the admin UI — no restart required. The database value takes precedence over env vars. See [OIDC / Single Sign-On](OIDC-Single-Sign-On).

---

## Minimal Production Checklist

Before going to production, ensure you have set:

- [ ] `NEXTAUTH_SECRET` — strong random secret
- [ ] `NEXTAUTH_URL` — correct public URL (no trailing slash)
- [ ] `JUST_GATE_BACKEND_JWT_SECRET` — same strong random value on both frontend and backend
- [ ] `JUST_GATE_DATABASE_URL` — PostgreSQL recommended for production
- [ ] `JUST_GATE_LOCAL_REGISTRATION_ENABLED=false` — unless you want open self-registration
- [ ] `JUSTGATE_INITIAL_ADMIN_EMAIL` — set for first-time bootstrap, then can be left as-is

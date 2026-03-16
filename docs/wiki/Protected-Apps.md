# Protected Apps

Protected Apps let you place any HTTP upstream service behind JustGate's authentication and access-control layer without modifying the upstream itself.

Each app is served at:

```
https://<justgate-domain>/app/<slug>/
```

```
Browser / API client
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  JustGate  (/app/{slug}/…)                          │
│                                                     │
│  1. IP allow/deny check (CIDR)                      │
│  2. Auth dispatch (OIDC session / bearer token)     │
│  3. Rate limiting (per session, IP, or token)       │
│  4. Header inject / strip                           │
│  5. Reverse proxy → upstream                        │
│  6. Redirect rewriting (3xx Location headers)       │
└─────────────────────────────────────────────────────┘
             │  X-Forwarded-Prefix: /app/{slug}
             │  X-Forwarded-Host, X-Forwarded-Proto
             ▼
     Upstream service
```

---

## Auth Modes

Each protected app is configured with one of four auth modes:

| Mode | Description |
|---|---|
| `oidc` | Browser users authenticate via the platform OIDC provider. A session cookie is issued and renewed automatically. Requires OIDC to be configured on the platform. |
| `bearer` | Requests must carry a valid app bearer token in the `Authorization: Bearer …` header. Suitable for M2M access, CI/CD pipelines, and scripts. |
| `any` | Either an OIDC session cookie **or** a bearer token is accepted. Covers mixed browser + API use cases. |
| `none` | All requests are forwarded without authentication. Only IP rules and rate limits apply. Useful when the upstream manages its own auth. |

### Difference from the core proxy

Protected Apps (`/app/{slug}/…`) use OIDC browser sessions rather than the tenant-scoped bearer tokens used by the core proxy (`/proxy/{slug}/…`). They are configured independently under **Apps** in the admin UI.

---

## App Configuration Fields

| Field | Description |
|---|---|
| **Slug** | URL-safe identifier. The app is served at `/app/<slug>/`. |
| **Upstream URL** | Base URL of the service to proxy to. |
| **Auth Mode** | One of `oidc`, `bearer`, `any`, `none` (see above). |
| **Health Check Path** | A path on the upstream that returns `200 OK` when healthy. Optional. |
| **Rate Limit RPM / Burst** | Requests per minute and burst size. Keyed per session, IP, or token depending on the `Rate Limit Key` setting. |
| **Allow CIDRs / Deny CIDRs** | CIDR-based IP filtering, evaluated before any auth check. |
| **Identity Headers** | Forward OIDC claims to the upstream as request headers (email, sub, name, groups). |
| **Custom CA** | Trust a specific CA certificate for TLS connections to this upstream. |

---

## Header Injection

When a user is authenticated via OIDC, JustGate can forward identity information to the upstream via request headers:

| Claim | Header |
|---|---|
| `email` | `X-Auth-Email` |
| `sub` | `X-Auth-Sub` |
| `name` | `X-Auth-Name` |
| `groups` | `X-Auth-Groups` (comma-separated) |

Configure which headers are forwarded in the app's **Identity Headers** settings. This lets the upstream know who is making the request without any auth logic of its own.

### Forwarding headers (always present)

JustGate unconditionally forwards these headers to every upstream request:

| Header | Value |
|---|---|
| `X-Forwarded-Prefix` | `/app/<slug>` |
| `X-Forwarded-Host` | Original `Host` header from the browser |
| `X-Forwarded-Proto` | `http` or `https` |

---

## Redirect Rewriting

When an upstream issues a `3xx` redirect, JustGate rewrites the `Location` header so the browser stays within the proxy path:

| Redirect type | Behaviour |
|---|---|
| Relative path (e.g. `/login`) | Prefixed with `/app/<slug>/` |
| Absolute URL pointing to upstream host | Host stripped; `/app/<slug>/` prepended |
| Absolute URL pointing to external host (e.g. OIDC provider) | Left untouched |

---

## Upstream Subpath Configuration

This is the most common issue when placing an existing web app behind a subpath proxy.

**Why it matters:** when an upstream app generates HTML with embedded URLs (asset bundles, API prefixes, redirect targets), it usually uses paths relative to its own root — for example `/public/app.js` or `/login`. The browser resolves these against the proxy origin, not the upstream host:

```
# Upstream sends:         Location: /login
# Browser resolves to:   https://justgate.example.com/login   ← 404
# Should be:             https://justgate.example.com/app/myapp/login
```

**What JustGate handles automatically:**
- 3xx redirect rewriting (see above)
- `X-Forwarded-Prefix`, `X-Forwarded-Host`, `X-Forwarded-Proto` headers

**What still requires upstream config:**  
HTML and JavaScript that embed absolute or root-relative URLs at render time (static asset manifests, inline `<script src="/…">`, SPA router base paths) cannot be rewritten by the proxy. These need a one-time config change on the upstream side.

---

## Per-App Configuration Examples

### Grafana

```ini
# grafana.ini
[server]
root_url = %(protocol)s://%(domain)s/app/<slug>/
serve_from_sub_path = true
```

Or via environment variables:

```bash
GF_SERVER_ROOT_URL=https://justgate.example.com/app/grafana/
GF_SERVER_SERVE_FROM_SUB_PATH=true
```

### Prometheus

```bash
--web.external-url=https://justgate.example.com/app/<slug>/
--web.route-prefix=/
```

### Alertmanager

```bash
--web.external-url=https://justgate.example.com/app/<slug>/
--web.route-prefix=/
```

### Uptime Kuma

```bash
# Environment variable (v1.21+):
BASE_URL=/app/<slug>
```

### Gitea

```ini
# app.ini
[server]
ROOT_URL = https://justgate.example.com/app/<slug>/
```

### Jupyter Lab / Notebook

```bash
jupyter lab --NotebookApp.base_url=/app/<slug>/
# Or in jupyter_notebook_config.py:
c.NotebookApp.base_url = "/app/<slug>/"
```

### Generic (`X-Forwarded-Prefix`)

Many frameworks read `X-Forwarded-Prefix` automatically and need no manual configuration:

- **Traefik** (as a downstream service)
- **Spring Boot** with `server.forward-headers-strategy=framework`
- **Express.js** with `app.set('trust proxy', true)` and `express-http-proxy`
- **Netdata** v1.37+

For frameworks that don't, most have a "base path" or "application root" setting — consult their reverse-proxy documentation.

---

## Bearer Tokens for Protected Apps

When an app uses `bearer` or `any` auth mode, you can issue scoped bearer tokens specifically for that app:

1. Open the app in **Apps**.
2. Click **Tokens → Issue Token**.
3. Copy the secret — it is shown once.
4. Use it in API calls:

```
Authorization: Bearer <token-secret>
```

Tokens can be revoked individually from the same panel.

---

## OIDC Session Management

When users authenticate via OIDC (`oidc` or `any` mode), their sessions are visible under the app's **Sessions** tab. Active sessions can be revoked individually, immediately invalidating the user's proxy access.

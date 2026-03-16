# Route & Token Configuration

This page covers the configuration options for routes and tokens: rate limiting, IP filtering, and tenant auth modes.

---

## Routes

A route is the stable proxy entry point for a tenant. Every proxied request arrives as:

```
GET /proxy/{slug}/…
Authorization: Bearer <token-secret>
```

Routes are created under **Routes** in the admin UI or via the [API](API-Reference).

### Route fields

| Field | Description |
|---|---|
| **Slug** | URL-safe identifier used in the proxy path (`/proxy/{slug}/…`). Immutable after creation. |
| **Tenant** | The tenant this route forwards traffic to. Determines the upstream URL and identity header value. |
| **Allowed Methods** | Comma-separated list of HTTP methods this route accepts (e.g. `GET,POST`). Requests with other methods are rejected with `405 Method Not Allowed`. Leave empty to allow all methods. |
| **Rate Limit RPM** | Maximum requests per minute. `0` disables route-level rate limiting. |
| **Rate Limit Burst** | Maximum burst above the steady-state rate. Defaults to RPM/10 when left at `0`. |
| **Allow CIDRs** | Comma-separated CIDR allowlist. If non-empty, only matching client IPs are allowed through. |
| **Deny CIDRs** | Comma-separated CIDR denylist. Matching client IPs are rejected with `403 Forbidden`. |

---

## Tokens

Tokens are scoped credentials issued to clients. Each token is associated with a **tenant** (not a route) and carries the scopes needed to use one or more routes.

### Token fields

| Field | Description |
|---|---|
| **Name** | Human-readable label for the token. |
| **Tenant** | The tenant this token can access. |
| **Scopes** | One or more route slugs. The token can only proxy through routes whose slug matches a granted scope. |
| **Expires At** | Optional expiry timestamp. Expired tokens are rejected automatically. |
| **Rate Limit RPM** | Per-token rate limit (requests per minute). Applied in addition to any route-level limit. Token-level limit takes precedence when more restrictive. |
| **Rate Limit Burst** | Per-token burst size. |

### Token secret

The token secret is shown **once** when issued. Store it securely — it cannot be retrieved again. If lost, revoke the token and issue a new one.

Tokens are sent as:

```
Authorization: Bearer <token-secret>
```

---

## Rate Limiting

Rate limits can be set at the **route level** (all tokens using that route share the quota) or the **token level** (applies to a single token regardless of route). When both are set, the more restrictive limit applies.

| Field | Description |
|---|---|
| **RPM** | Maximum requests per minute. `0` = unlimited. |
| **Burst** | Maximum requests allowed above the steady-state rate in a short window. Defaults to RPM/10. |

When a request is rejected by the rate limiter, JustGate returns:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

The event is recorded in the audit log and counted in the traffic analytics dashboard.

### Redis for multi-replica deployments

By default, rate-limit counters are stored in-process. For deployments with more than one backend pod, configure Redis so counters are shared:

```bash
JUST_GATE_REDIS_URL=redis://redis:6379
```

See [Configuration](Configuration) and [Deployment](Deployment) for details.

---

## IP Allow / Deny Lists

Per-route CIDR lists control which client IPs can use a route. Both IPv4 and IPv6 CIDRs are supported.

| Field | Description |
|---|---|
| **Allow CIDRs** | If non-empty, only IPs matching one of the CIDRs are allowed. All others receive `403 Forbidden`. |
| **Deny CIDRs** | IPs matching any of the CIDRs are rejected with `403 Forbidden`. Evaluated **before** the allowlist. |

**Evaluation order:**
1. If the client IP matches a **Deny CIDR** → `403 Forbidden`
2. If **Allow CIDRs** is non-empty and the client IP does **not** match → `403 Forbidden`
3. Otherwise → proceed to token validation

**Examples:**

```
# Allow only RFC-1918 private ranges
Allow CIDRs: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16

# Block a specific CIDR
Deny CIDRs: 203.0.113.0/24

# Allow from a specific /27 block only
Allow CIDRs: 198.51.100.0/27
```

---

## Auth Modes (Tenant Identity)

Each tenant can be configured with one of the following modes for how identity is injected into upstream requests:

| Mode | Description |
|---|---|
| `header` | Tenant identity is injected as a plain request header (default). The header name is configured via `JUST_GATE_TENANT_HEADER` (default: `X-Scope-OrgID`). |
| `jwt` | Tenant identity is injected as a claim inside a signed JWT header. Useful when the upstream expects a signed token rather than a plain string. |
| `none` | No identity header is injected. The request is forwarded as-is. Useful when the upstream does not need to know the tenant ID. |

---

## Circuit Breaker

Each tenant's upstream is guarded by a circuit breaker. When the upstream returns repeated errors, the circuit opens and JustGate immediately returns `502 Bad Gateway` without forwarding the request (reducing load on the failing upstream). The circuit enters a half-open state periodically to test recovery.

Circuit breaker state is reflected in the [Live Topology Map](Observability#live-topology-map) — failing edges turn red and clear automatically when the upstream recovers.

---

## Load Balancing

A tenant can have multiple upstream URLs configured with weights and a primary/replica designation. JustGate distributes traffic across the upstream list according to the configured weights. If a primary upstream fails its health check, traffic shifts to replicas automatically.

Configure additional upstream URLs under the **Tenants → Upstreams** section for a given tenant.

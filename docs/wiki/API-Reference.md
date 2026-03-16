# API Reference

All admin endpoints require a valid backend admin JWT in the `Authorization` header:

```
Authorization: Bearer <jwt>
```

The JWT is minted by the frontend (`JUST_GATE_BACKEND_JWT_SECRET`) and is short-lived. In normal usage the frontend handles JWT minting transparently. When calling the backend directly, obtain a JWT by authenticating via the local auth or OIDC endpoints.

---

## Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Returns `200 OK` when the backend is reachable and the database connection is healthy |

---

## Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/local/register` | Register a new local admin account (`email`, `password`) |
| `POST` | `/api/v1/auth/local/verify` | Verify local credentials and obtain a short-lived admin JWT |

---

## Overview & Search

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/overview` | Summary counts (tenants, routes, tokens, apps) and instance status |
| `GET` | `/api/v1/admin/search?q=…` | Global search across routes, tenants, and tokens |

---

## Tenants

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/tenants` | List all tenants in the active organisation |
| `POST` | `/api/v1/admin/tenants` | Create a tenant |
| `GET` | `/api/v1/admin/tenants/{id}` | Get a tenant by ID |
| `PUT` | `/api/v1/admin/tenants/{id}` | Update a tenant |
| `DELETE` | `/api/v1/admin/tenants/{id}` | Delete a tenant (cascades routes and tokens) |
| `GET` | `/api/v1/admin/tenants/{id}/upstreams` | List load-balancing upstream URLs for a tenant |
| `POST` | `/api/v1/admin/tenants/{id}/upstreams` | Add an upstream URL to a tenant |
| `DELETE` | `/api/v1/admin/tenant-upstream/{upstreamID}` | Remove a tenant upstream URL |
| `GET` | `/api/v1/admin/health-history` | Upstream health check history across all tenants |

---

## Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/routes` | List all routes |
| `POST` | `/api/v1/admin/routes` | Create a route |
| `GET` | `/api/v1/admin/routes/{id}` | Get a route by ID |
| `PUT` | `/api/v1/admin/routes/{id}` | Update a route |
| `DELETE` | `/api/v1/admin/routes/{id}` | Delete a route |

---

## Tokens

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/tokens` | List all tokens |
| `POST` | `/api/v1/admin/tokens` | Issue a new token |
| `GET` | `/api/v1/admin/tokens/{id}` | Get a token by ID |
| `PATCH` | `/api/v1/admin/tokens/{id}` | Update token fields (e.g. revoke, rename) |
| `DELETE` | `/api/v1/admin/tokens/{id}` | Permanently delete a token |

---

## Audit & Traffic

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/audit?page=1&pageSize=50` | Paginated audit log |
| `GET` | `/api/v1/admin/traffic/stats?hours=24` | 5-minute traffic stat buckets for the given time window |
| `GET` | `/api/v1/admin/traffic/overview` | 24 h vs prior 24 h KPI summary |

---

## Topology

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/topology` | Current topology snapshot (nodes + edges) |
| `GET` | `/api/v1/admin/topology/stream` | Live topology via WebSocket — emits the full snapshot on connect, then incremental updates |

---

## Route Tester

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/route-test` | Execute a test request through the proxy and return the response |

Request body:
```json
{
  "routeId": "<route-id>",
  "method": "GET",
  "path": "/api/status",
  "headers": { "X-Custom": "value" },
  "tokenSecret": "<bearer-token-secret>"
}
```

---

## Organisations

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/orgs` | List organisations the caller is a member of |
| `POST` | `/api/v1/admin/orgs` | Create a new organisation |

---

## Sessions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/sessions` | List active admin sessions for the caller |
| `POST` | `/api/v1/admin/sessions` | Create an admin session (used internally by the frontend auth flow) |
| `DELETE` | `/api/v1/admin/sessions/{id}` | Revoke an admin session |

---

## Protected Apps

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/apps` | List all protected apps |
| `POST` | `/api/v1/admin/apps` | Create a protected app |
| `GET` | `/api/v1/admin/apps/{id}` | Get a protected app by ID |
| `PUT` | `/api/v1/admin/apps/{id}` | Update a protected app |
| `DELETE` | `/api/v1/admin/apps/{id}` | Delete a protected app |
| `GET` | `/api/v1/admin/apps/{id}/tokens` | List bearer tokens for a protected app |
| `POST` | `/api/v1/admin/apps/{id}/tokens` | Issue a bearer token for a protected app |
| `DELETE` | `/api/v1/admin/apps/{id}/tokens/{tokenID}` | Revoke an app bearer token |
| `GET` | `/api/v1/admin/apps/{id}/sessions` | List active OIDC sessions for a protected app |
| `DELETE` | `/api/v1/admin/apps/{id}/sessions/{sessionID}` | Revoke a specific OIDC session for a protected app |
| `ANY` | `/app/{slug}/…` | Authenticated proxy surface for protected apps |

---

## Platform Admin

All routes in this section require the caller to hold the platform admin role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/platform/check` | Returns `200 OK` if the caller is a platform admin, `403` otherwise |
| `GET` | `/api/v1/admin/platform/admins` | List all platform admins |
| `POST` | `/api/v1/admin/platform/admins` | Grant platform admin by email |
| `DELETE` | `/api/v1/admin/platform/admins/{userID}` | Revoke platform admin |
| `GET` | `/api/v1/admin/platform/users` | List all users across all organisations |
| `DELETE` | `/api/v1/admin/platform/users/{userID}` | Delete a user account |
| `GET` | `/api/v1/admin/platform/orgs` | List all organisations with member counts |
| `DELETE` | `/api/v1/admin/platform/orgs/{orgID}` | Delete an organisation and cascade all its resources |

---

## Core Proxy

| Method | Path | Description |
|---|---|---|
| `ANY` | `/proxy/{slug}/…` | Tenant-aware proxy surface for bearer-token clients. Validates the token, enforces rate limits and IP rules, and forwards to the configured upstream. |

---

## Pagination

Endpoints that return lists support `page` and `pageSize` query parameters:

```
GET /api/v1/admin/audit?page=1&pageSize=50
```

Default `pageSize` is 50. There is no enforced maximum, but large page sizes will increase response latency.

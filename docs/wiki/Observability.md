# Observability

JustGate includes several built-in observability tools accessible directly from the admin UI — no external monitoring stack required.

---

## Traffic Analytics Dashboard

The dashboard (accessible via **Overview** in the sidebar) aggregates proxy traffic into 5-minute buckets and displays:

- **Request volume** over time — area chart with error overlay
- **24 h vs prior 24 h comparison** — table showing total requests, error rate, and average latency for the current and previous 24-hour windows
- **KPI strip** — total requests, error rate, average latency, and prior-period request count at a glance

### What's counted

Traffic stats are recorded for **every proxied request**, including gateway-rejected ones:

| Status | Cause |
|---|---|
| `429 Too Many Requests` | Rate limit exceeded |
| `403 Forbidden` | IP denylist or allowlist miss |
| `502 Bad Gateway` | Upstream unreachable or circuit open |

Stats are scoped to the active organisation — multi-org deployments always see their own data.

### Retention

Stats are stored as 5-minute buckets in the database. You can configure automatic pruning — or trigger a manual purge — from **Settings → Traffic Stats Retention**.

| Setting | Description |
|---|---|
| **Retention period** | How many days of traffic stat buckets to keep (default: 30 days) |
| **Auto-purge** | When enabled, the backend automatically prunes buckets older than the retention period every 6 hours |
| **Purge now** | Immediately deletes all buckets older than the configured retention period and reports how many rows were removed |

Auto-purge only removes `traffic_stats` rows — audit events, health history, and all configuration data are unaffected.

---

## Live Topology Map

Available at **Topology** in the sidebar, the topology page shows a real-time interactive graph of your configuration:

```
[ Token ] ──── [ Route ] ──── [ Tenant ] ──── [ Upstream ]
```

### Node and edge states

| Colour | Meaning |
|---|---|
| Green | Healthy / reachable |
| Red | Error or unreachable upstream (clears automatically 30 s after the last error) |

### Animated traffic

Edges with traffic in the last 30 seconds show animated packet icons to indicate active flow.

### Node inspector

Click any node to open a side panel with:
- Full details of the entity (slug, upstream URL, token scopes, etc.)
- Quick-action buttons (edit, delete, create connected resource)

### Draft mode

The **Draft** button lets you create routes, tokens, or tenants directly on the graph without navigating away from the topology view. New nodes appear immediately and can be connected by dragging.

### WebSocket stream

The topology is kept up to date via a WebSocket connection to `/api/v1/admin/topology/stream`. If the connection drops, the UI reconnects automatically.

---

## Route Tester

The Route Tester is a built-in HTTP client available from the **Routes** page. Use it to test a route without needing `curl` or a separate API client.

### Features

| Feature | Description |
|---|---|
| **Route selector** | Pick a route to auto-fill the proxy URL and constrain the method dropdown to the route's allowed methods |
| **Token hints** | Shows compatible active tokens for the selected route's tenant |
| **Auto-injected Authorization header** | Paste a token secret and it is sent as `Authorization: Bearer <secret>` automatically |
| **Extra headers** | Add arbitrary request headers alongside the auto-injected auth |
| **cURL preview** | Live-generated `curl` command that reflects all current settings; one-click copy to clipboard |

### Using the route tester

1. Open **Routes** and click the test icon on any route.
2. Select the HTTP method.
3. Enter the path suffix (appended after `/proxy/{slug}/`).
4. Paste a token secret or pick a suggested token.
5. Click **Send** — the response status, headers, and body appear inline.
6. Copy the cURL preview to repeat the request from a terminal.

---

## Upstream Health

Each tenant can have a health check path configured. JustGate periodically probes the upstream and stores:

| Field | Description |
|---|---|
| **Status** | `up`, `down`, or `unknown` |
| **Latency** | Response time in milliseconds |
| **Last checked** | Timestamp of the most recent probe |
| **Last error** | Error message from the most recent failed probe (if any) |
| **History** | Last 10 probe results |

Health status is reflected in real time in the topology map (node colour) and in the tenant detail panel.

### Configuring health checks

Set the **Health Check Path** field on a tenant to a path that returns `200 OK` when the upstream is healthy (e.g. `/healthz`, `/-/ready`). Leave empty to disable health checks for that tenant.

---

## Audit Log

Every proxied request is recorded and viewable at **Audit** in the sidebar.

Each audit entry contains:

| Field | Description |
|---|---|
| **Timestamp** | When the request was received |
| **Method** | HTTP method |
| **Path** | Request path (relative to the proxy surface) |
| **Upstream URL** | The full URL forwarded to the upstream |
| **Status** | HTTP response status code |
| **Latency** | Round-trip time in milliseconds |
| **Token** | Token that was used (name, ID) |
| **Tenant** | Tenant the request was routed to |
| **Route** | Route slug |

The log is paginated and filterable. It is also accessible via the [API](API-Reference) at `GET /api/v1/admin/audit`.

---

## Instance Panel

The **Overview → Instances** panel shows all running backend instances reporting to the same database. Each entry displays:

- **Instance ID** — hostname or custom `INSTANCE_ID` value
- **Region** — optional region/AZ label from the `REGION` env var
- **Last seen** — timestamp of the most recent heartbeat

This is useful in multi-replica Kubernetes deployments to verify that all pods are healthy and connected to the database.

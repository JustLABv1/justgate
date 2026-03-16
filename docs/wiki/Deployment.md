# Deployment

This page covers production deployment of JustGate on Kubernetes using the provided Helm chart.

For development or single-server setups, see [Quick Start](Quick-Start).

---

## Helm Chart

The Helm chart lives in `deploy/helm/justgate` and is published to the GitHub Container Registry as an OCI chart.

### Deployment modes

| Mode | Pod layout | Database | When to use |
|---|---|---|---|
| `monolithic` *(default)* | Single pod (frontend + backend) | SQLite | Small teams, single-replica, quick setup |
| `microservice` | Separate frontend and backend pods | PostgreSQL | Production, horizontal scaling, HA |

---

## Install from OCI Registry (Recommended)

```bash
# Monolithic — single pod, SQLite
helm install justgate oci://ghcr.io/justlabv1/justgate --version <version> \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)
```

```bash
# Microservice mode with PostgreSQL
helm install justgate oci://ghcr.io/justlabv1/justgate --version <version> \
  --set mode=microservice \
  --set postgresql.auth.password=change-me \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.nextauthSecret=$(openssl rand -hex 32) \
  --set backend.jwtSecret=$(openssl rand -hex 32)
```

---

## Install from Source

```bash
helm dependency update deploy/helm/justgate

# Monolithic
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

---

## Key Helm Values

| Value | Default | Description |
|---|---|---|
| `mode` | `monolithic` | `monolithic` (single pod, SQLite) or `microservice` (split pods, PostgreSQL) |
| `postgresql.enabled` | `true` | Deploy a Bitnami PostgreSQL subchart alongside JustGate |
| `postgresql.auth.password` | — | **Required** when `postgresql.enabled` is true |
| `backend.jwtSecret` | — | JWT signing secret. Must match `frontend.backendJwtSecret`. |
| `backend.tenantHeaderName` | `X-Scope-OrgID` | Upstream tenant identity header name |
| `backend.initialAdminEmail` | — | Email of the first platform admin (see [Platform Admin](Platform-Admin)) |
| `backend.redisUrl` | — | Redis URL for distributed rate limiting (required in multi-replica setups) |
| `backend.instanceId` | *(pod name)* | Override instance ID shown in Overview → Instances. Leave empty to use the pod name (injected via Downward API). |
| `backend.region` | — | Optional region/AZ label shown in the Instances panel (e.g. `us-east-1`) |
| `frontend.nextauthUrl` | — | **Required.** Public base URL of the frontend. |
| `frontend.nextauthSecret` | — | **Required.** NextAuth.js session signing secret. |
| `frontend.oidc.issuer` | — | OIDC issuer URL (enables SSO when set). See [OIDC / Single Sign-On](OIDC-Single-Sign-On). |
| `frontend.oidc.clientId` | — | OIDC client ID |
| `frontend.oidc.clientSecret` | — | OIDC client secret (stored in a Kubernetes Secret automatically) |
| `frontend.oidc.name` | `Single Sign-On` | Label on the SSO sign-in button |
| `ingress.enabled` | `false` | Enable Kubernetes Ingress |
| `ingress.host` | — | Hostname for the Ingress rule |
| `ingress.tls.enabled` | `false` | Enable TLS on the Ingress |
| `persistence.size` | `1Gi` | PVC size for SQLite data (unused when PostgreSQL is enabled) |
| `customCAs.enabled` | `false` | Mount custom CA certificates (for internal IdP TLS). See [OIDC — Internal CA](OIDC-Single-Sign-On#internal-ca--self-signed-certificates). |

See [`deploy/helm/justgate/values.yaml`](../deploy/helm/justgate/values.yaml) for the full reference.

---

## Example: Production values.yaml

```yaml
mode: microservice

frontend:
  nextauthUrl: "https://justgate.example.com"
  nextauthSecret: "<generated>"
  backendJwtSecret: "<generated>"
  localRegistrationEnabled: false
  oidc:
    issuer: "https://keycloak.example.com/realms/myrealm"
    clientId: "justgate"
    clientSecret: "<secret>"
    name: "Login with Keycloak"

backend:
  jwtSecret: "<generated>"       # same value as frontend.backendJwtSecret
  initialAdminEmail: "admin@example.com"
  tenantHeaderName: "X-Scope-OrgID"

postgresql:
  enabled: true
  auth:
    password: "<generated>"

ingress:
  enabled: true
  host: justgate.example.com
  tls:
    enabled: true

persistence:
  size: 1Gi
```

---

## Upgrading

```bash
helm upgrade justgate oci://ghcr.io/justlabv1/justgate --version <new-version> \
  -f values.yaml
```

Database schema migrations run automatically on startup — no manual intervention needed.

---

## Multi-Replica / Redis

In `microservice` mode with more than one backend replica, rate-limit counters must be stored in Redis to be shared across pods:

```yaml
backend:
  redisUrl: "redis://redis-master.redis.svc.cluster.local:6379"
```

Deploy Redis separately (e.g. with the Bitnami Redis chart) or use a managed service.

---

## Checking Pod Health

```bash
# Check pod status
kubectl get pods -l app.kubernetes.io/name=justgate

# Backend health check
kubectl exec -it <pod> -- wget -qO- http://localhost:9090/healthz

# Tail frontend logs
kubectl logs -l app.kubernetes.io/component=frontend -f
```

---

## Uninstalling

```bash
helm uninstall justgate
```

> If you used SQLite with a PVC, delete the PVC manually: `kubectl delete pvc -l app.kubernetes.io/name=justgate`

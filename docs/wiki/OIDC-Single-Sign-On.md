# OIDC / Single Sign-On

JustGate supports OIDC-based single sign-on on top of (or instead of) local accounts.

---

## Configuration Methods

| Method | When it takes effect | Suitable for |
|---|---|---|
| **Setup wizard** (`/setup`) | Immediately on first run | Initial bootstrap |
| **Admin UI** (Settings → OIDC) | Immediately (stored in DB) | Runtime changes, secret rotation |
| **Helm values / env vars** | On pod start (static) | GitOps, CI/CD pipelines |

The Admin UI (DB) configuration takes precedence over env vars when an enabled OIDC record is stored in the database.

### Enabled toggle

When configuring OIDC via the Admin UI, make sure the **SSO active** toggle is on before saving. The sign-in page only shows the SSO button when the stored config has `enabled = true`. The toggle auto-activates as soon as you fill in all three required fields (issuer, client ID, client secret).

---

## How Auto-Discovery Works

JustGate uses OIDC **Discovery** to configure next-auth automatically. On startup it fetches:

```
GET <issuer>/.well-known/openid-configuration
```

The response must return **HTTP 200** with a valid JSON document. If the pod receives anything else — `503`, `404`, connection refused, TLS error — the sign-in flow will fail immediately with `SIGNIN_OAUTH_ERROR`.

---

## Issuer URL Format

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
> Verify by opening that URL in a browser — you should see a JSON document with an `issuer` field.

---

## Troubleshooting the 503 / 5xx Discovery Error

The error `expected 200 OK, got: 503 Service Unavailable` means next-auth reached the server but received a failure response while fetching the discovery document.

### Common causes and fixes

**1. Wrong realm / path**

The URL resolves but the realm doesn't exist or the path is wrong.

```bash
curl -v https://<issuer>/.well-known/openid-configuration
```

**2. Provider temporarily unavailable**

The IdP is overloaded or still starting. Wait and retry.

**3. Pod cannot reach the IdP**

If the IdP is on an internal network, DNS may resolve but routing rules or Kubernetes NetworkPolicies may block traffic.

```bash
kubectl exec -it <justgate-pod> -- \
  wget -qO- https://<issuer>/.well-known/openid-configuration
```

**4. Internal / self-signed CA**

The discovery request fails TLS verification (shows as `unable to get local issuer certificate`). Fix: configure `customCAs` in Helm — see [Internal CA / Self-Signed Certificates](#internal-ca--self-signed-certificates).

**5. Trailing slash mismatch**

JustGate strips a trailing slash from the issuer automatically. If you still see issues, ensure your IdP and the issuer value you supply have the same format (both with or both without a trailing slash).

---

## Option A — Helm / Env Vars (Static)

Set the OIDC values in `values.yaml`:

```yaml
frontend:
  nextauthUrl: "https://justgate.example.com"
  oidc:
    issuer: "https://keycloak.example.com/realms/myrealm"
    clientId: "justgate"
    clientSecret: "your-client-secret"
    name: "Login with Keycloak"   # optional button label
```

Or pass with `--set` flags:

```bash
helm upgrade justgate oci://ghcr.io/justlabv1/justgate \
  --set frontend.nextauthUrl=https://justgate.example.com \
  --set frontend.oidc.issuer=https://keycloak.example.com/realms/myrealm \
  --set frontend.oidc.clientId=justgate \
  --set frontend.oidc.clientSecret=<secret>
```

> The `clientId` and `clientSecret` are written into a Kubernetes `Secret` automatically by the chart. You do not need to create it manually.

Or as environment variables on the frontend container:

```bash
JUST_GATE_OIDC_ISSUER=https://keycloak.example.com/realms/myrealm
JUST_GATE_OIDC_CLIENT_ID=justgate
JUST_GATE_OIDC_CLIENT_SECRET=<secret>
JUST_GATE_OIDC_NAME="Login with Keycloak"
```

---

## Option B — Admin UI (Dynamic)

1. Sign in as an admin and navigate to **Settings → OIDC**.
2. Fill in the fields:

| Field | Description |
|---|---|
| **Issuer URL** | Full issuer URL including realm (see table above). No trailing slash. |
| **Client ID** | The client/application ID registered in your IdP. |
| **Client Secret** | The client secret. Leave blank to keep the existing stored value. |
| **Button Label** | Text shown on the sign-in page (default: `Single Sign-On`). |
| **Groups Claim** | JWT claim containing groups/roles for org mapping (e.g. `groups` or `realm_access.roles`). Optional. |

3. The **SSO active** toggle (at the bottom of the form) must be **on** for the sign-in button to appear. It activates automatically once the issuer, client ID, and client secret are all filled in — you rarely need to touch it manually.
4. Click **Save**. Changes take effect on the next sign-in request — no restart needed.

> The client secret is AES-256-GCM encrypted before being written to the database.

---

## Keycloak Client Configuration

In Keycloak, create a new client for JustGate:

| Setting | Value |
|---|---|
| **Client type** | `OpenID Connect` |
| **Client ID** | `justgate` (or whatever you set as `clientId`) |
| **Client authentication** | `On` (confidential client) |
| **Valid redirect URIs** | `https://justgate.example.com/api/auth/callback/oidc` |
| **Web origins** | `https://justgate.example.com` |

Retrieve the client secret from the **Credentials** tab.

### Optional: groups claim

If you want to use [OIDC Org Mappings](#oidc-org-mappings), add a mapper to include groups in the ID token:

1. Open the client in Keycloak → **Client scopes** → `justgate-dedicated` (or the default scope).
2. Add a **Group Membership** mapper.
3. Set **Token Claim Name** to `groups`.
4. Enable **Add to ID token**.

---

## Internal CA / Self-Signed Certificates

If your IdP uses a certificate signed by an internal CA, mount the CA bundle via Helm:

### Option 1: Inline PEM

```yaml
customCAs:
  enabled: true
  certificates: |
    -----BEGIN CERTIFICATE-----
    MIIBxTCCAW+gAwIBAgIJA...
    -----END CERTIFICATE-----
```

### Option 2: Existing ConfigMap

```yaml
customCAs:
  enabled: true
  existingConfigMap: my-ca-bundle   # must have a 'ca-bundle.crt' key
```

The chart automatically sets `NODE_EXTRA_CA_CERTS` for the Next.js process so that discovery requests and token exchange use the custom CA.

---

## OIDC Org Mappings

JustGate can automatically assign users to organisations based on OIDC groups or roles:

### Setup

1. Ensure your IdP includes a groups/roles claim in the ID token (see [Keycloak Client Configuration](#keycloak-client-configuration) above).
2. In **Settings → OIDC**, set the **Groups Claim** field to the name of that claim (e.g. `groups`, `realm_access.roles`).
3. Navigate to **Settings → OIDC → Org Mappings** and map OIDC group names to JustGate organisation names.

### Behaviour

When a user signs in via OIDC, JustGate reads the groups claim from the ID token and automatically adds the user to mapped organisations. If the user's groups change in the IdP, the membership is updated on the next sign-in.

### Example mapping

| OIDC Group | JustGate Organisation |
|---|---|
| `platform-team` | `platform` |
| `ops-eu` | `operations-eu` |
| `ops-us` | `operations-us` |

---

## Disabling Local Accounts

To run OIDC-only (no email/password login):

```bash
# Env var
JUST_GATE_LOCAL_ACCOUNTS_ENABLED=false
```

```yaml
# Helm values.yaml
frontend:
  localAccountsEnabled: false
```

When `localAccountsEnabled` is `false`, the email/password form is hidden from the sign-in page and the local registration endpoint is disabled.

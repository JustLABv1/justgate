# Platform Admin

Platform admins are a superadmin role that sits above organisation owners. Unlike regular users who only see their own organisation's resources, platform admins have cross-organisation visibility and control through a dedicated **Platform Admin** section in the navigation.

---

## Bootstrap the First Admin

The platform admin role is seeded via the `JUSTGATE_INITIAL_ADMIN_EMAIL` environment variable (or `backend.initialAdminEmail` in Helm).

**Important:** The user must first sign in (creating their account) before the seed takes effect. The backend retries the lookup every 15 seconds for up to 10 minutes after startup.

### Local development

```bash
JUSTGATE_INITIAL_ADMIN_EMAIL=you@example.com go run ./cmd/server
```

### Docker Compose

```yaml
environment:
  JUSTGATE_INITIAL_ADMIN_EMAIL: you@example.com
```

### Helm (`values.yaml`)

```yaml
backend:
  initialAdminEmail: "you@example.com"
```

### Helm (`--set`)

```bash
helm upgrade justgate oci://ghcr.io/justlabv1/justgate \
  --set backend.initialAdminEmail=you@example.com \
  ...
```

### After seeding

1. Sign in as the user whose email you set.
2. The backend grants the platform admin role automatically (check the logs if it doesn't appear after a minute).
3. **Sign out and sign back in** to get the Platform Admin section to appear in the sidebar.

The seed is idempotent — the env var can be left set permanently. After the first admin is set up, additional admins can be granted (or revoked) through **Platform Admin → Platform Admins** in the UI.

---

## Capabilities

| Section | What you can do |
|---|---|
| **Platform Admin → All Users** | View all registered users across every organisation; delete individual accounts |
| **Platform Admin → All Orgs** | View all organisations with member counts; delete organisations (cascades all associated resources) |
| **Platform Admin → Platform Admins** | Grant or revoke the platform admin role by email address |
| **Platform Admin → Settings** | Configure OIDC / SSO provider settings and org mappings at the platform level |

---

## Granting Additional Admins

Once you have at least one platform admin, you can grant the role to others without touching environment variables:

1. Navigate to **Platform Admin → Platform Admins**.
2. Enter the user's email address and click **Grant**.
3. The user must sign out and sign back in to see the Platform Admin section.

To revoke a grant, click **Revoke** next to the user in the same view.

---

## Security Considerations

- Platform admins can **delete any organisation** and **delete any user account** — these are irreversible operations. Only grant this role to trusted individuals.
- The `JUSTGATE_INITIAL_ADMIN_EMAIL` env var only controls the *first-time bootstrap*. Subsequent grants/revocations happen entirely through the UI and are stored in the database.
- The platform admin check is enforced server-side on every route in the `/api/v1/admin/platform/…` namespace.

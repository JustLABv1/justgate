import { SignJWT } from "jose";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const backendUrl =
  process.env.JUST_GATE_BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:9090";
const localAccountsEnabled = process.env.JUST_GATE_LOCAL_ACCOUNTS_ENABLED !== "false";
const localRegistrationEnabled = process.env.JUST_GATE_LOCAL_REGISTRATION_ENABLED !== "false";
const authSecret = process.env.NEXTAUTH_SECRET || "justgate-local-auth-secret";
const backendJwtSecret = new TextEncoder().encode(
  process.env.JUST_GATE_BACKEND_JWT_SECRET || "justgate-local-backend-jwt-secret",
);

// ── OIDC config resolved at startup ────────────────────────────────────

interface ResolvedOIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  displayName: string;
  groupsClaim: string;
  enabled: boolean;
}

/** Create a short-lived JWT scoped to a specific user — used for sign-in-time checks. */
async function createUserAdminToken(userId: string, email: string, name: string): Promise<string> {
  return new SignJWT({
    email,
    name,
    roles: ["admin"],
    scope: "admin:control",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer("justgate-admin")
    .setAudience("justgate-backend")
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(backendJwtSecret);
}

/** Create a system-level JWT (no user context) for internal backend calls. */
async function createSystemToken(): Promise<string> {
  return new SignJWT({ roles: ["admin"], scope: "admin:control" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("system:frontend")
    .setIssuer("justgate-admin")
    .setAudience("justgate-backend")
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(backendJwtSecret);
}

/** Fetch OIDC provider config from the backend (includes decrypted secret). */
async function fetchOIDCProviderConfig(): Promise<ResolvedOIDCConfig | null> {
  try {
    const token = await createSystemToken();
    const response = await fetch(`${backendUrl}/api/v1/internal/oidc-provider-config`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      issuer: string;
      clientID: string;
      clientSecret: string;
      displayName: string;
      groupsClaim: string;
      enabled: boolean;
    };
    if (!data.enabled || !data.issuer || !data.clientID || !data.clientSecret) return null;
    return {
      issuer: data.issuer,
      clientId: data.clientID,
      clientSecret: data.clientSecret,
      displayName: data.displayName,
      groupsClaim: data.groupsClaim,
      enabled: data.enabled,
    };
  } catch {
    return null;
  }
}

/** Resolve OIDC config: DB first, then env vars as fallback. */
async function resolveOIDCConfig(): Promise<ResolvedOIDCConfig | null> {
  const dbConfig = await fetchOIDCProviderConfig();
  if (dbConfig) return dbConfig;

  // Fallback to env vars
  const issuer = process.env.JUST_GATE_OIDC_ISSUER?.replace(/\/$/, "");
  const clientId = process.env.JUST_GATE_OIDC_CLIENT_ID;
  const clientSecret = process.env.JUST_GATE_OIDC_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    issuer,
    clientId,
    clientSecret,
    displayName: process.env.JUST_GATE_OIDC_NAME || "Single Sign-On",
    groupsClaim: "",
    enabled: true,
  };
}

// ── TTL-based OIDC config cache ────────────────────────────────────────
// Refreshes every 60 seconds so changes saved via the UI take effect
// without requiring a service restart.
//
// State is kept on globalThis so that all bundles within the same Node.js
// process (Server Components, Route Handlers, etc.) share the same cache.
// Module-level variables are not reliably shared across Next.js bundles.

const OIDC_TTL_MS = 60_000;

type OIDCGlobalCache = {
  oidcCacheValue: ResolvedOIDCConfig | null;
  oidcCacheExpiry: number;
  oidcCachePending: Promise<ResolvedOIDCConfig | null> | null;
};

const g = globalThis as typeof globalThis & OIDCGlobalCache;
if (g.oidcCacheExpiry === undefined) {
  g.oidcCacheValue = null;
  g.oidcCacheExpiry = 0;
  g.oidcCachePending = null;
}

async function getResolvedOIDC(): Promise<ResolvedOIDCConfig | null> {
  const now = Date.now();
  if (now < g.oidcCacheExpiry) return g.oidcCacheValue;

  // Deduplicate concurrent refreshes
  if (!g.oidcCachePending) {
    g.oidcCachePending = resolveOIDCConfig().then((cfg) => {
      g.oidcCacheValue = cfg;
      g.oidcCacheExpiry = Date.now() + OIDC_TTL_MS;
      g.oidcCachePending = null;
      return cfg;
    }).catch(() => {
      // On error keep last known value and retry sooner (10s)
      g.oidcCacheExpiry = Date.now() + 10_000;
      g.oidcCachePending = null;
      return g.oidcCacheValue;
    });
  }
  return g.oidcCachePending;
}

/** Immediately invalidate the OIDC config cache so the next request re-fetches. */
export function bustOIDCCache() {
  g.oidcCacheExpiry = 0;
  g.oidcCachePending = null;
}

export async function isOIDCEnabled(): Promise<boolean> {
  const cfg = await getResolvedOIDC();
  return cfg !== null;
}

export async function getOIDCDisplayName(): Promise<string> {
  const cfg = await getResolvedOIDC();
  return cfg?.displayName || "Single Sign-On";
}

export function isLocalAccountsEnabled() {
  return localAccountsEnabled;
}

export function isLocalRegistrationEnabled() {
  return localAccountsEnabled && localRegistrationEnabled;
}

// ── Build auth options ─────────────────────────────────────────────────

async function buildAuthOptions(): Promise<NextAuthOptions> {
  const providers: NonNullable<NextAuthOptions["providers"]> = [];

  const oidc = await getResolvedOIDC();
  if (oidc) {
    providers.push({
      id: "oidc",
      name: oidc.displayName || "Single Sign-On",
      type: "oauth",
      wellKnown: `${oidc.issuer}/.well-known/openid-configuration`,
      clientId: oidc.clientId,
      clientSecret: oidc.clientSecret,
      idToken: true,
      checks: ["pkce", "state"],
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
      profile(profile: Record<string, unknown>) {
        const subject = String(profile.sub || profile.email || "admin-user");
        return {
          id: subject,
          name:
            (typeof profile.name === "string" && profile.name) ||
            (typeof profile.preferred_username === "string" && profile.preferred_username) ||
            (typeof profile.email === "string" && profile.email) ||
            "Admin User",
          email:
            (typeof profile.email === "string" && profile.email) || `${subject}@local.invalid`,
        };
      },
    } as NextAuthOptions["providers"][number]);
  }

  if (isLocalAccountsEnabled()) {
    providers.push(
      CredentialsProvider({
        id: "credentials",
        name: "Local Account",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const response = await fetch(`${backendUrl}/api/v1/auth/local/verify`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
            cache: "no-store",
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null) as { error?: string } | null;
            throw new Error(body?.error || "Sign-in failed");
          }

          const account = (await response.json()) as {
            id: string;
            name: string;
            email: string;
          };

          return {
            id: account.id,
            name: account.name,
            email: account.email,
          };
        },
      }),
    );
  }

  return {
    providers,
    secret: authSecret,
    pages: { signIn: "/signin" },
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, user, account, trigger, session }) {
        if (user) {
          token.sub = user.id;
          token.email = user.email;
          token.name = user.name;
          // Check platform admin status immediately on sign-in
          try {
            const checkToken = await createUserAdminToken(
              user.id,
              user.email ?? "",
              user.name ?? "",
            );
            const res = await fetch(`${backendUrl}/api/v1/admin/platform/check`, {
              headers: { authorization: `Bearer ${checkToken}` },
              cache: "no-store",
            });
            if (res.ok) {
              const data = (await res.json()) as { isPlatformAdmin: boolean };
              token.isPlatformAdmin = data.isPlatformAdmin;
            } else {
              token.isPlatformAdmin = false;
            }
          } catch {
            token.isPlatformAdmin = false;
          }
        }
        if (account?.provider) {
          token.provider = account.provider;
        }
        if (trigger === "update" && session?.activeOrgId !== undefined) {
          token.activeOrgId = session.activeOrgId as string;
        }
        if (trigger === "update" && session?.isPlatformAdmin !== undefined) {
          token.isPlatformAdmin = session.isPlatformAdmin as boolean;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub || session.user.email || "admin-user";
          session.user.email = token.email || session.user.email;
          session.user.name = token.name || session.user.name;
        }
        session.activeOrgId = (token.activeOrgId as string | undefined) ?? undefined;
        session.isPlatformAdmin = (token.isPlatformAdmin as boolean | undefined) ?? false;
        session.provider = (token.provider as string | undefined) ?? undefined;
        return session;
      },
    },
  };
}

/** Build fresh auth options on every call. OIDC resolution is TTL-cached internally. */
export function getAuthOptions(): Promise<NextAuthOptions> {
  return buildAuthOptions();
}

export async function auth() {
  const options = await getAuthOptions();
  return getServerSession(options);
}
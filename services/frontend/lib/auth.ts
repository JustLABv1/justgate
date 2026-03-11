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

// Cached resolved config — initialized once on first access
let resolvedOIDCPromise: Promise<ResolvedOIDCConfig | null> | null = null;
function getResolvedOIDC(): Promise<ResolvedOIDCConfig | null> {
  if (!resolvedOIDCPromise) {
    resolvedOIDCPromise = resolveOIDCConfig();
  }
  return resolvedOIDCPromise;
}

// Synchronous flag for quick checks (set after first resolve)
let oidcEnabledCache: boolean | null = null;

export async function isOIDCEnabled(): Promise<boolean> {
  if (oidcEnabledCache !== null) return oidcEnabledCache;
  const cfg = await getResolvedOIDC();
  oidcEnabledCache = cfg !== null;
  return oidcEnabledCache;
}

export function isLocalAccountsEnabled() {
  return localAccountsEnabled;
}

export function isLocalRegistrationEnabled() {
  return localAccountsEnabled && localRegistrationEnabled;
}

// ── Build auth options ─────────────────────────────────────────────────

let authOptionsPromise: Promise<NextAuthOptions> | null = null;

async function buildAuthOptions(): Promise<NextAuthOptions> {
  const providers: NonNullable<NextAuthOptions["providers"]> = [];

  const oidc = await getResolvedOIDC();
  if (oidc) {
    oidcEnabledCache = true;
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
  } else {
    oidcEnabledCache = false;
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
        }
        if (account?.provider) {
          token.provider = account.provider;
        }
        if (trigger === "update" && session?.activeOrgId !== undefined) {
          token.activeOrgId = session.activeOrgId as string;
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
        return session;
      },
    },
  };
}

export function getAuthOptions(): Promise<NextAuthOptions> {
  if (!authOptionsPromise) {
    authOptionsPromise = buildAuthOptions();
  }
  return authOptionsPromise;
}

export async function auth() {
  const options = await getAuthOptions();
  return getServerSession(options);
}
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const oidcIssuer = process.env.JUST_GATE_OIDC_ISSUER?.replace(/\/$/, "");
const oidcClientId = process.env.JUST_GATE_OIDC_CLIENT_ID;
const oidcClientSecret = process.env.JUST_GATE_OIDC_CLIENT_SECRET;
const backendUrl =
  process.env.JUST_GATE_BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:9090";
const localAccountsEnabled = process.env.JUST_GATE_LOCAL_ACCOUNTS_ENABLED !== "false";
const localRegistrationEnabled = process.env.JUST_GATE_LOCAL_REGISTRATION_ENABLED !== "false";
const authSecret = process.env.NEXTAUTH_SECRET || "just-gate-local-auth-secret";

export function isOIDCEnabled() {
  return Boolean(oidcIssuer && oidcClientId && oidcClientSecret);
}

export function isLocalAccountsEnabled() {
  return localAccountsEnabled;
}

export function isLocalRegistrationEnabled() {
  return localAccountsEnabled && localRegistrationEnabled;
}

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (isOIDCEnabled()) {
  providers.push({
    id: "oidc",
    name: process.env.JUST_GATE_OIDC_NAME || "Single Sign-On",
    type: "oauth",
    wellKnown: `${oidcIssuer}/.well-known/openid-configuration`,
    clientId: oidcClientId,
    clientSecret: oidcClientSecret,
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
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const response = await fetch(`${backendUrl}/api/v1/auth/local/verify`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
          }),
          cache: "no-store",
        });

        if (!response.ok) {
          return null;
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

export const authOptions: NextAuthOptions = {
  providers,
  secret: authSecret,
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      if (account?.provider) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || session.user.email || "admin-user";
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const oidcIssuer = process.env.JUST_PROXY_GUARD_OIDC_ISSUER?.replace(/\/$/, "");
const oidcClientId = process.env.JUST_PROXY_GUARD_OIDC_CLIENT_ID;
const oidcClientSecret = process.env.JUST_PROXY_GUARD_OIDC_CLIENT_SECRET;
const devAdminPassword =
  process.env.JUST_PROXY_GUARD_DEV_ADMIN_PASSWORD ||
  (process.env.NODE_ENV === "production" ? undefined : "dev-admin");
const authSecret = process.env.NEXTAUTH_SECRET || "just-proxy-guard-local-auth-secret";

export function isOIDCEnabled() {
  return Boolean(oidcIssuer && oidcClientId && oidcClientSecret);
}

export function isDevAuthEnabled() {
  return Boolean(devAdminPassword);
}

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (isOIDCEnabled()) {
  providers.push({
    id: "oidc",
    name: process.env.JUST_PROXY_GUARD_OIDC_NAME || "Single Sign-On",
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

if (isDevAuthEnabled()) {
  providers.push(
    CredentialsProvider({
      id: "credentials",
      name: "Local Admin",
      credentials: {
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!devAdminPassword || credentials?.password !== devAdminPassword) {
          return null;
        }

        return {
          id: "dev-admin",
          name: process.env.JUST_PROXY_GUARD_DEV_ADMIN_NAME || "Local Admin",
          email: process.env.JUST_PROXY_GUARD_DEV_ADMIN_EMAIL || "admin@local.dev",
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
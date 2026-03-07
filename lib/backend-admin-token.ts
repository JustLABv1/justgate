import "server-only";

import type { Session } from "next-auth";
import { SignJWT } from "jose";

const backendJwtSecret = new TextEncoder().encode(
  process.env.JUST_PROXY_GUARD_BACKEND_JWT_SECRET ||
    "just-proxy-guard-local-backend-jwt-secret",
);

export async function createBackendAdminToken(session: Session) {
  const subject = session.user?.id || session.user?.email;
  if (!subject) {
    throw new Error("missing session subject");
  }

  return new SignJWT({
    email: session.user?.email,
    name: session.user?.name,
    roles: ["admin"],
    scope: "admin:control",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(subject)
    .setIssuer("just-proxy-guard-admin")
    .setAudience("just-proxy-guard-backend")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(backendJwtSecret);
}
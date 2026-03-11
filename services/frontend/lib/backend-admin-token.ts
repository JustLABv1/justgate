import "server-only";

import { SignJWT } from "jose";
import type { Session } from "next-auth";

const backendJwtSecret = new TextEncoder().encode(
  process.env.JUST_GATE_BACKEND_JWT_SECRET ||
    "justgate-local-backend-jwt-secret",
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
    .setIssuer("justgate-admin")
    .setAudience("justgate-backend")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(backendJwtSecret);
}
import "server-only";

import { auth } from "@/lib/auth";
import { createBackendAdminToken } from "@/lib/backend-admin-token";

const backendUrl =
  process.env.JUST_GATE_BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:9090";

/** Internal URL used for server-side backend API calls (pod-internal, never shown to users). */
export function getBackendBaseUrl() {
  return backendUrl;
}

/**
 * Public-facing base URL for displaying links to the user.
 * Uses NEXTAUTH_URL (the ingress / public URL) so that displayed proxy route
 * URLs match what is actually reachable from outside the cluster.
 */
export function getPublicBaseUrl() {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "";
}

/**
 * Public-facing URL for reaching the backend from the browser.
 *
 * By default this equals NEXTAUTH_URL (works when the reverse proxy routes
 * all traffic – including /api/v1/* – to the backend).
 *
 * Set JUST_GATE_PUBLIC_BACKEND_URL when the backend is exposed on a different
 * domain or port than the frontend, e.g. when a reverse proxy only forwards
 * port 3000 and the backend is reachable via a separate subdomain/port:
 *   JUST_GATE_PUBLIC_BACKEND_URL=https://api.justgate.example.com
 */
export function getPublicBackendUrl() {
  return (
    process.env.JUST_GATE_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
    getPublicBaseUrl() ||
    getBackendBaseUrl()
  );
}

export async function getAdminRequestHeaders(incomingHeaders?: Headers | Record<string, string>): Promise<HeadersInit> {
  const session = await auth();
  if (!session?.user?.id) {
    return {};
  }

  const token = await createBackendAdminToken(session);
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  if (session.activeOrgId) {
    headers["X-Org-ID"] = session.activeOrgId;
  }

  // Forward the real browser IP and User-Agent so the Go backend records
  // the actual client info in admin sessions rather than the Next.js server's.
  try {
    const { headers: nextHeaders } = await import("next/headers");
    const reqHeaders = incomingHeaders ? (incomingHeaders instanceof Headers ? incomingHeaders : new Headers(incomingHeaders)) : await nextHeaders();
    const ua = reqHeaders.get("user-agent");
    const xff = reqHeaders.get("x-forwarded-for");
    const realIp = reqHeaders.get("x-real-ip");
    if (ua) headers["X-Forwarded-User-Agent"] = ua;
    if (xff) headers["X-Forwarded-For"] = xff;
    else if (realIp) headers["X-Forwarded-For"] = realIp;
  } catch {
    // Not in a request context (e.g. build time) — skip header forwarding.
  }

  return headers;
}

export function hasAdminRequestAuthorization(headers: HeadersInit) {
  if (headers instanceof Headers) {
    return Boolean(headers.get("authorization"));
  }

  if (Array.isArray(headers)) {
    return headers.some(([name, value]) => name.toLowerCase() === "authorization" && Boolean(value));
  }

  return Boolean(headers.authorization);
}
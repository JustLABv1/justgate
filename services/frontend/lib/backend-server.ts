import "server-only";

import { auth } from "@/lib/auth";
import { createBackendAdminToken } from "@/lib/backend-admin-token";

const backendUrl =
  process.env.JUST_GATE_BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:9090";

export function getBackendBaseUrl() {
  return backendUrl;
}

export async function getAdminRequestHeaders(): Promise<HeadersInit> {
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
import { auth } from "@/lib/auth";
import { createBackendAdminToken } from "@/lib/backend-admin-token";
import { getBackendBaseUrl, getPublicBaseUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Use the public base URL (ingress) for the WebSocket URL so the browser can
  // reach it. Fall back to the internal backend URL for local development.
  const publicBase = getPublicBaseUrl() || getBackendBaseUrl();
  const wsUrl = publicBase.replace(/^http/, "ws") + "/api/v1/admin/topology/stream";
  const token = await createBackendAdminToken(session);

  return NextResponse.json({ token, wsUrl, orgId: session.activeOrgId ?? null });
}
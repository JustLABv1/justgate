import { auth } from "@/lib/auth";
import { createBackendAdminToken } from "@/lib/backend-admin-token";
import { getPublicBackendUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Use the public backend URL so the browser can reach the WS endpoint.
  // In a reverse-proxy setup where the backend is on a different domain/port
  // than the frontend, set JUST_GATE_PUBLIC_BACKEND_URL accordingly.
  const wsUrl = getPublicBackendUrl().replace(/^http/, "ws") + "/api/v1/admin/topology/stream";
  const token = await createBackendAdminToken(session);

  return NextResponse.json({ token, wsUrl, orgId: session.activeOrgId ?? null });
}
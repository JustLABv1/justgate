import { createBackendAdminToken } from "@/lib/backend-admin-token";
import { auth } from "@/lib/auth";
import { getBackendBaseUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const backendUrl = getBackendBaseUrl();
  const wsUrl = backendUrl.replace(/^http/, "ws") + "/api/v1/admin/topology/stream";
  const token = await createBackendAdminToken(session);

  return NextResponse.json({ token, wsUrl });
}
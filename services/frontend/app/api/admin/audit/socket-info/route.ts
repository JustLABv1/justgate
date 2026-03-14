import { auth } from "@/lib/auth";
import { createBackendAdminToken } from "@/lib/backend-admin-token";
import { getPublicBackendUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // SSE endpoint – works through every reverse proxy without a WebSocket
  // upgrade handshake.  The browser reconnects automatically on disconnect.
  const sseUrl = getPublicBackendUrl() + "/api/v1/admin/audit/sse";
  const token = await createBackendAdminToken(session);

  return NextResponse.json({ token, sseUrl });
}

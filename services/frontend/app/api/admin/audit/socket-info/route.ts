import { auth } from "@/lib/auth";
import { createBackendAdminToken } from "@/lib/backend-admin-token";
import { getPublicBackendUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const wsUrl = getPublicBackendUrl().replace(/^http/, "ws") + "/api/v1/admin/audit/stream";
  const token = await createBackendAdminToken(session);

  return NextResponse.json({ token, wsUrl });
}

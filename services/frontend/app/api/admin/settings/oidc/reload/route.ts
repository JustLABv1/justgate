import { bustOIDCCache } from "@/lib/auth";
import { hasAdminRequestAuthorization, getAdminRequestHeaders } from "@/lib/backend-server";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/settings/oidc/reload
 *
 * Immediately invalidates the frontend's TTL-cached OIDC provider config so
 * the next auth request picks up any changes saved to the database without
 * waiting for the 60-second TTL to expire.
 */
export async function POST() {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  bustOIDCCache();
  return NextResponse.json({ ok: true });
}

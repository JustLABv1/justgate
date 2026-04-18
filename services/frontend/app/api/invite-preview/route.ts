import { getBackendBaseUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

// Public endpoint — no admin auth required, used by the join page
// to preview the org name before accepting an invite.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const response = await fetch(
    `${getBackendBaseUrl()}/api/v1/invite-preview?code=${encodeURIComponent(code)}`,
    { cache: "no-store" },
  );

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

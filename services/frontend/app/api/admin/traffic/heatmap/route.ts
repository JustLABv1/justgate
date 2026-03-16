import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = searchParams.get("days") ?? "7";

  const response = await fetch(
    `${getBackendBaseUrl()}/api/v1/admin/traffic/heatmap?days=${encodeURIComponent(days)}`,
    { headers, cache: "no-store" },
  );

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

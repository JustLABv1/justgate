import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const routeSlug = url.searchParams.get("routeSlug") ?? "";
  const hours = url.searchParams.get("hours") ?? "24";
  const response = await fetch(
    `${getBackendBaseUrl()}/api/v1/admin/traffic/route?routeSlug=${encodeURIComponent(routeSlug)}&hours=${hours}`,
    { method: "GET", headers, cache: "no-store" },
  );

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

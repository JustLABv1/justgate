import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ routeID: string }> },
) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { routeID } = await params;
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/route-upstreams/${encodeURIComponent(routeID)}`, {
    headers,
    cache: "no-store",
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ routeID: string }> },
) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { routeID } = await params;
  const body = await request.text();
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/route-upstreams/${encodeURIComponent(routeID)}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    cache: "no-store",
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

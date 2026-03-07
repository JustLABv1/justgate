import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/tokens`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
    cache: "no-store",
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
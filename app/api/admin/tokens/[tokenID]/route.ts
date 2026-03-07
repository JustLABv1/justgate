import { getAdminRequestHeaders, hasAdminRequestAuthorization, getBackendBaseUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tokenID: string }> },
) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tokenID } = await params;
  const body = await request.text();
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/tokens/${tokenID}`, {
    method: "PATCH",
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
import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantID: string }> },
) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tenantID } = await params;
  const body = await request.text();
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/tenants/${tenantID}`, {
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tenantID: string }> },
) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tenantID } = await params;
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/tenants/${tenantID}`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return new NextResponse(null, {
      status: 204,
    });
  }

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
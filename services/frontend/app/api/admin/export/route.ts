import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET(_request: Request) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const response = await fetch(`${getBackendBaseUrl()}/api/v1/admin/export`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const contentDisposition = response.headers.get("content-disposition") || 'attachment; filename="justgate-config.json"';
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type": "application/json",
      "content-disposition": contentDisposition,
    },
  });
}

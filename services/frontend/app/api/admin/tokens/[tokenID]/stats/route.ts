import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenID: string }> },
) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tokenID } = await params;
  const url = new URL(request.url);
  const hours = url.searchParams.get("hours") ?? "24";
  const response = await fetch(
    `${getBackendBaseUrl()}/api/v1/admin/tokens/${tokenID}/stats?hours=${hours}`,
    { method: "GET", headers, cache: "no-store" },
  );

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

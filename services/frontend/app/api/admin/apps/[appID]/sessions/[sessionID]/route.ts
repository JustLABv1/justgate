import { getAdminRequestHeaders, getBackendBaseUrl, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

type Params = Promise<{ appID: string; sessionID: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { appID, sessionID } = await params;
  const response = await fetch(
    `${getBackendBaseUrl()}/api/v1/admin/apps/${appID}/sessions/${sessionID}`,
    { method: "DELETE", headers, cache: "no-store" },
  );

  if (response.status === 204) return new NextResponse(null, { status: 204 });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

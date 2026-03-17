import { getBackendBaseUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${getBackendBaseUrl()}/api/v1/setup/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

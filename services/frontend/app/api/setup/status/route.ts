import { getBackendBaseUrl } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/v1/setup/status`, {
      cache: "no-store",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json({ setupRequired: false }, { status: 200 });
  }
}

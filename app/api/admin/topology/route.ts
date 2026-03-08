import { getTopology } from "@/lib/backend-client";
import { getAdminRequestHeaders, hasAdminRequestAuthorization } from "@/lib/backend-server";
import { NextResponse } from "next/server";

export async function GET() {
  const headers = await getAdminRequestHeaders();
  if (!hasAdminRequestAuthorization(headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getTopology();
  return NextResponse.json(result, {
    status: 200,
  });
}
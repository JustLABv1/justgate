import { getAuthOptions } from "@/lib/auth";
import NextAuth from "next-auth";

// Auth options are resolved per-request so that OIDC config changes
// (saved via the UI and TTL-cached in auth.ts) take effect without restart.
async function handler(
  ...args: Parameters<ReturnType<typeof NextAuth>>
) {
  const authOptions = await getAuthOptions();
  return NextAuth(authOptions)(...args);
}

export { handler as GET, handler as POST };

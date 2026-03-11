import { getAuthOptions } from "@/lib/auth";
import NextAuth from "next-auth";

const authOptionsPromise = getAuthOptions();

async function handler(
  ...args: Parameters<ReturnType<typeof NextAuth>>
) {
  const authOptions = await authOptionsPromise;
  return NextAuth(authOptions)(...args);
}

export { handler as GET, handler as POST };

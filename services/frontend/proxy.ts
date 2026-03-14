import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const authSecret = process.env.NEXTAUTH_SECRET || "justgate-local-auth-secret";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname === "/signin" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: authSecret });
  if (token) {
    return NextResponse.next();
  }

  const signInURL = new URL("/signin", request.url);
  const callbackUrl = `${pathname}${request.nextUrl.search}`;
  signInURL.searchParams.set("callbackUrl", callbackUrl || "/");
  return NextResponse.redirect(signInURL);
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
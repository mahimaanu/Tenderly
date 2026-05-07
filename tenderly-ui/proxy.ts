import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const OFFICER_PREFIX = "/officer"
const BIDDER_PREFIX = "/bidder"
const COOKIE = "tenderly_token"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE)?.value

  const needsOfficer = pathname.startsWith(OFFICER_PREFIX)
  const needsBidder = pathname.startsWith(BIDDER_PREFIX)

  if ((needsOfficer || needsBidder) && !token) {
    const loginPath = needsOfficer ? "/officer-login" : "/bidder-login"
    return NextResponse.redirect(new URL(loginPath, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/officer/:path*", "/bidder/:path*"],
}

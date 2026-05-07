import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const store = await cookies()
  store.delete("tenderly_token")
  // Redirect to home on the same origin as the frontend request
  return NextResponse.redirect(new URL("/", request.url))
}

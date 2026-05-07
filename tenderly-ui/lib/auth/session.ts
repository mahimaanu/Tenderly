import { cache } from "react"
import { redirect } from "next/navigation"

const COOKIE = "tenderly_token"
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1"

// cache() memoises per request — cookies() has access because we're in the
// same AsyncLocalStorage context as the server component / server action.
export const getServerToken = cache(async (): Promise<string | null> => {
  try {
    const { cookies } = await import("next/headers")
    const store = await cookies()
    return store.get(COOKIE)?.value ?? null
  } catch {
    return null
  }
})

export async function setSessionCookie(token: string) {
  const { cookies } = await import("next/headers")
  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  })
}

export async function clearSessionCookie() {
  const { cookies } = await import("next/headers")
  const store = await cookies()
  store.delete(COOKIE)
}

export async function requireSession(): Promise<string> {
  const token = await getServerToken()
  if (!token) redirect("/")
  return token
}

export async function serverFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getServerToken()
  const headers = new Headers(init.headers as HeadersInit)
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const b = await res.json()
      msg = b?.error?.message ?? msg
    } catch {}
    throw new Error(`API ${res.status}: ${msg}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

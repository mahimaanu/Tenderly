const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json()
    const err = body?.error ?? {}
    return new ApiError(res.status, err.code ?? "ERROR", err.message ?? res.statusText)
  } catch {
    return new ApiError(res.status, "NETWORK", res.statusText)
  }
}

function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)tenderly_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { serverToken?: string } = {},
): Promise<T> {
  const token = init.serverToken ?? getToken()
  const headers = new Headers(init.headers as HeadersInit)
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return res.json()
}

export function apiUrl(path: string) {
  return `${BASE}${path}`
}

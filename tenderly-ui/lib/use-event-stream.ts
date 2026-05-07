"use client"
import { useEffect } from "react"

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1"

function getToken(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)tenderly_token=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function useEventStream<T = unknown>(
  path: string | null,
  handlers: Partial<Record<string, (data: T) => void>>,
) {
  useEffect(() => {
    if (!path) return
    const token = getToken()
    const url = `${BASE}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`
    const es = new EventSource(url)

    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) {
        es.addEventListener(event, (e: MessageEvent) => {
          try {
            handler(JSON.parse(e.data))
          } catch {}
        })
      }
    }

    es.onerror = () => es.close()
    return () => es.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
}

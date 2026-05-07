import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseDbDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const normalized = String(s)
    .replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T") // "YYYY-MM-DD HH:..." → "YYYY-MM-DDTHH:..."
    .replace(/(\.\d{3})\d+/, "$1")             // microseconds → milliseconds (JS Date only handles 3 dp)
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? null : d
}

export function fmtDate(s: string | null | undefined): string {
  const d = parseDbDate(s)
  if (!d) return "—"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function fmtDateTime(s: string | null | undefined): string {
  const d = parseDbDate(s)
  if (!d) return "—"
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
}

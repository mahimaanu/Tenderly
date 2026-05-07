import { serverFetch } from "../auth/session"

export type AuditEvent = {
  id: string
  timestamp: string
  actor_id?: string
  actor_role: string
  actor_label: string
  action: string
  target_type: string
  target_id: string
  detail?: Record<string, unknown>
  request_id?: string
  prev_hash?: string
  hash: string
}

export type AuditPage = {
  data: AuditEvent[]
  meta: { page: number; page_size: number; total: number }
}

export async function getAuditFeed(params?: {
  actor_role?: string
  action?: string
  from?: string
  to?: string
  page?: number
  page_size?: number
}): Promise<AuditPage> {
  const qs = new URLSearchParams()
  if (params?.actor_role) qs.set("actor_role", params.actor_role)
  if (params?.action) qs.set("action", params.action)
  if (params?.from) qs.set("from", params.from)
  if (params?.to) qs.set("to", params.to)
  if (params?.page) qs.set("page", String(params.page))
  if (params?.page_size) qs.set("page_size", String(params.page_size))
  const query = qs.toString() ? `?${qs}` : ""
  return serverFetch<AuditPage>(`/audit${query}`).catch(() => ({
    data: [],
    meta: { page: 1, page_size: 25, total: 0 },
  }))
}

export async function getTenderAudit(tenderId: string, page = 1): Promise<AuditPage> {
  return serverFetch<AuditPage>(`/tenders/${tenderId}/audit?page=${page}`).catch(() => ({
    data: [],
    meta: { page: 1, page_size: 25, total: 0 },
  }))
}

export async function getBidderAudit(bidderId: string, tenderId?: string): Promise<AuditPage> {
  const qs = tenderId ? `?tender_id=${tenderId}` : ""
  return serverFetch<AuditPage>(`/bidders/${bidderId}/audit${qs}`).catch(() => ({
    data: [],
    meta: { page: 1, page_size: 25, total: 0 },
  }))
}

export async function getHeadHash(): Promise<{ hash: string }> {
  return serverFetch<{ hash: string }>("/audit/head-hash").catch(() => ({ hash: "" }))
}

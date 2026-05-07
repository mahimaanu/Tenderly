import { serverFetch } from "../auth/session"
import { apiFetch } from "./client"

export type Notification = {
  id: string
  kind: string
  title: string
  body?: string
  target_url?: string
  read_at?: string
  created_at: string
}

export type NotificationPage = {
  data: Notification[]
  meta: { page: number; page_size: number; unread_count: number }
}

export async function getNotifications(params?: {
  read?: boolean
  page?: number
}): Promise<NotificationPage> {
  const qs = new URLSearchParams()
  if (params?.read !== undefined) qs.set("read", String(params.read))
  if (params?.page) qs.set("page", String(params.page))
  const query = qs.toString() ? `?${qs}` : ""
  return serverFetch<NotificationPage>(`/notifications${query}`).catch(() => ({
    data: [],
    meta: { page: 1, page_size: 25, unread_count: 0 },
  }))
}

export async function markRead(id: string): Promise<void> {
  return apiFetch(`/notifications/${id}/read`, { method: "POST" })
}

export async function markAllRead(): Promise<void> {
  return apiFetch("/notifications/read-all", { method: "POST" })
}

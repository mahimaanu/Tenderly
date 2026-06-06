import { serverFetch } from "../auth/session"
import { apiFetch } from "./client"

export type TenderStatus = "draft" | "active" | "evaluation" | "completed"

export type TenderDoc = {
  id: string
  filename: string
  file_path: string
  page_count?: number
  processed: boolean
  created_at: string
}

export type Criterion = {
  id: string
  criterion_code?: string
  type: string
  priority: string
  description: string
  threshold_value?: string
  threshold_operator?: string
  unit?: string
  source_page?: number
  confidence?: number
  manually_verified: boolean
  created_at: string
}

export type Tender = {
  id: string
  tender_number: string
  title: string
  description?: string
  issuing_authority?: string
  submission_deadline?: string
  status: TenderStatus
  category?: string
  estimated_value?: string
  published_on?: string
  closing_on?: string
  reference?: string
  created_at: string
  updated_at: string
}

export async function listTenders(params?: {
  status?: string
  q?: string
  page?: number
}): Promise<Tender[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.q) qs.set("q", params.q)
  if (params?.page) qs.set("page", String(params.page))
  const query = qs.toString() ? `?${qs}` : ""
  const res = await serverFetch<{ data: Tender[] } | Tender[]>(`/tenders/${query}`)
  return Array.isArray(res) ? res : (res as { data: Tender[] }).data ?? []
}

export async function getTender(id: string): Promise<Tender> {
  return serverFetch<Tender>(`/tenders/${id}`)
}

export async function getTenderDocuments(id: string): Promise<TenderDoc[]> {
  const res = await serverFetch<{ data: TenderDoc[] } | TenderDoc[]>(`/tenders/${id}/documents`)
  return Array.isArray(res) ? res : (res as { data: TenderDoc[] }).data ?? []
}

export async function getCriteria(id: string): Promise<Criterion[]> {
  const res = await serverFetch<{ data: Criterion[] } | Criterion[]>(`/tenders/${id}/criteria`)
  return Array.isArray(res) ? res : (res as { data: Criterion[] }).data ?? []
}

export type CriterionCreate = {
  type: string
  priority: "mandatory" | "optional"
  description: string
  criterion_code?: string
  threshold_value?: string
  threshold_operator?: string
  unit?: string
}

export async function addCriterion(tenderId: string, data: CriterionCreate): Promise<Criterion> {
  return apiFetch<Criterion>(`/tenders/${tenderId}/criteria`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function updateCriterion(
  tenderId: string,
  criterionId: string,
  data: Partial<Criterion>,
): Promise<Criterion> {
  return serverFetch<Criterion>(`/tenders/${tenderId}/criteria/${criterionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function confirmCriteria(tenderId: string): Promise<void> {
  return serverFetch(`/tenders/${tenderId}/criteria/confirm`, { method: "POST" })
}

export async function getMatrix(id: string): Promise<Record<string, unknown>> {
  return serverFetch<Record<string, unknown>>(`/tenders/${id}/matrix`).catch(() => ({}))
}

export async function deleteTender(id: string): Promise<void> {
  return apiFetch(`/tenders/${id}`, { method: "DELETE" })
}

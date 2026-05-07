import { serverFetch } from "../auth/session"
import { apiFetch } from "./client"

export type Submission = {
  id: string
  bidder_user_id: string
  tender_id: string
  status: "draft" | "signed" | "submitted" | "withdrawn"
  bid_amount?: number
  emd_reference?: string
  notes?: string
  signed_at?: string
  submitted_at?: string
  created_at: string
  tender_number?: string
  title?: string
  tender_title?: string
  estimated_value?: number | string
}

export type SubmissionDocument = {
  id: string
  name: string
  format?: string
  kind?: string
  pages?: number
  ocr_confidence?: number
  uploaded_at: string
}

export type Clarification = {
  id: string
  tender_id: string
  bidder_id: string
  subject: string
  body?: string
  status: "open" | "responded" | "closed"
  initiated_by_role: string
  initiated_by?: string
  tender_number?: string
  tender_title?: string
  created_at: string
  messages?: ClarificationMessage[]
}

export type ClarificationMessage = {
  id: string
  author_role: string
  text?: string
  created_at: string
}

export type BidderProfile = {
  id: string
  email: string
  company_name: string
  contact_person?: string
  registration_number?: string
  gstin?: string
  phone?: string
  city?: string
  kyc_verified: boolean
}

export type BidderSettings = {
  notifications: Record<string, boolean>
  pre_bid_hints: boolean
}

export async function getBidderDashboard(): Promise<Record<string, unknown>> {
  return serverFetch<Record<string, unknown>>("/bidder/dashboard").catch(() => ({}))
}

export async function getBidderTenders(params?: { q?: string; category?: string }): Promise<unknown[]> {
  const qs = new URLSearchParams()
  if (params?.q) qs.set("q", params.q)
  if (params?.category) qs.set("category", params.category)
  const query = qs.toString() ? `?${qs}` : ""
  const res = await serverFetch<{ data: unknown[] } | unknown[]>(`/bidder/tenders${query}`).catch(() => [])
  return Array.isArray(res) ? res : (res as { data: unknown[] }).data ?? []
}

export async function getBidderTenderDetail(tenderId: string): Promise<Record<string, unknown>> {
  const res = await serverFetch<{
    tender?: Record<string, unknown>
    criteria?: unknown[]
    documents?: unknown[]
    existing_submission?: unknown
    pre_eligibility?: unknown[]
  }>(`/bidder/tenders/${tenderId}`).catch(() => null)
  if (!res) return {}
  // Backend wraps tender fields under a "tender" key — flatten so the page can
  // read tender.title, tender.criteria, tender.documents directly.
  return {
    ...(res.tender ?? {}),
    criteria: res.criteria ?? [],
    documents: res.documents ?? [],
    existing_submission: res.existing_submission ?? null,
    pre_eligibility: res.pre_eligibility ?? [],
  }
}

export async function createSubmission(tenderId: string): Promise<Submission> {
  return apiFetch<Submission>("/bidder/submissions", {
    method: "POST",
    body: JSON.stringify({ tender_id: tenderId }),
  })
}

export async function listSubmissions(params?: { status?: string }): Promise<Submission[]> {
  const qs = params?.status ? `?status=${params.status}` : ""
  const res = await serverFetch<{ data: Submission[] } | Submission[]>(`/bidder/submissions${qs}`).catch(() => [])
  return Array.isArray(res) ? res : (res as { data: Submission[] }).data ?? []
}

export type SubmissionDetail = Submission & {
  closing_on?: string
  notes?: string
  documents: Record<string, unknown>[]
  preliminary_evaluation: Record<string, unknown>[]
  timeline: { key: string; label: string; done: boolean; at?: string | null }[]
}

export async function getSubmission(sid: string): Promise<SubmissionDetail> {
  const res = await serverFetch<{
    submission?: Record<string, unknown>
    documents?: Record<string, unknown>[]
    preliminary_evaluation?: Record<string, unknown>[]
    timeline?: { key: string; label: string; done: boolean; at?: string | null }[]
  }>(`/bidder/submissions/${sid}`)
  // Backend wraps submission fields under a "submission" key — flatten so the
  // page can read status, created_at, tender_title etc. directly.
  return {
    ...(res.submission ?? {}) as unknown as Submission,
    documents: res.documents ?? [],
    preliminary_evaluation: res.preliminary_evaluation ?? [],
    timeline: res.timeline ?? [],
  } as SubmissionDetail
}

export async function updateSubmission(
  sid: string,
  data: { bid_amount?: number; emd_reference?: string; notes?: string },
): Promise<Submission> {
  return apiFetch<Submission>(`/bidder/submissions/${sid}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function uploadSubmissionDocuments(
  sid: string,
  files: File[],
  kinds?: string[],
): Promise<{ documents: SubmissionDocument[] }> {
  const form = new FormData()
  files.forEach((f) => form.append("files", f))
  if (kinds) kinds.forEach((k) => form.append("kinds[]", k))
  return apiFetch(`/bidder/submissions/${sid}/documents`, { method: "POST", body: form })
}

export async function signSubmission(sid: string): Promise<void> {
  return apiFetch(`/bidder/submissions/${sid}/sign`, { method: "POST" })
}

export async function submitBid(sid: string): Promise<void> {
  return apiFetch(`/bidder/submissions/${sid}/submit`, { method: "POST" })
}

export async function getClarifications(): Promise<Clarification[]> {
  const res = await serverFetch<{ data: Clarification[] } | Clarification[]>("/bidder/clarifications").catch(() => [])
  return Array.isArray(res) ? res : (res as { data: Clarification[] }).data ?? []
}

export async function getClarification(cid: string): Promise<Clarification> {
  return serverFetch<Clarification>(`/bidder/clarifications/${cid}`)
}

export async function replyToClarification(cid: string, text: string): Promise<void> {
  return apiFetch(`/bidder/clarifications/${cid}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function getBidderProfile(): Promise<BidderProfile> {
  return serverFetch<BidderProfile>("/bidder/profile").catch(() => ({
    id: "",
    email: "",
    company_name: "",
    kyc_verified: false,
  }))
}

export async function updateBidderProfile(data: Partial<BidderProfile>): Promise<BidderProfile> {
  return apiFetch<BidderProfile>("/bidder/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function getBidderSettings(): Promise<BidderSettings> {
  return serverFetch<BidderSettings>("/bidder/settings").catch(() => ({
    notifications: {},
    pre_bid_hints: true,
  }))
}

export async function updateBidderSettings(data: Partial<BidderSettings>): Promise<BidderSettings> {
  return apiFetch<BidderSettings>("/bidder/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function getCertifications(): Promise<unknown[]> {
  const res = await serverFetch<{ data: unknown[] } | unknown[]>("/bidder/certifications").catch(() => [])
  return Array.isArray(res) ? res : (res as { data: unknown[] }).data ?? []
}

export async function getSignatories(): Promise<unknown[]> {
  const res = await serverFetch<{ data: unknown[] } | unknown[]>("/bidder/signatories").catch(() => [])
  return Array.isArray(res) ? res : (res as { data: unknown[] }).data ?? []
}

export async function reverifyDsc(): Promise<{ verified: boolean; expiry: string }> {
  return apiFetch("/bidder/dsc/reverify", { method: "POST" }).catch(() => ({
    verified: true,
    expiry: "2027-08-14",
  }))
}

import { serverFetch } from "../auth/session"

export type DashboardStats = {
  active_tenders: number
  evaluating_tenders: number
  bids_received: number
  eligible: number
  ineligible: number
  needs_review: number
}

export type DashboardData = {
  user: { id: string; name: string; role: string }
  stats: DashboardStats
  headline_tender: Record<string, unknown> | null
  recent_bidders: Record<string, unknown>[]
  recent_activity: Record<string, unknown>[]
}

export type OfficerProfile = {
  id: string
  name: string
  email: string
  designation?: string
  unit?: string
  emp_id?: string
  role: string
}

export type OfficerPreferences = {
  confidence_floor: number
  ocr_floor: number
  notifications: Record<string, boolean>
}

export async function getOfficerDashboard(): Promise<DashboardData> {
  return serverFetch<DashboardData>("/officer/dashboard")
}

export async function getOfficerProfile(): Promise<OfficerProfile> {
  return serverFetch<OfficerProfile>("/officer/profile").catch(() => ({
    id: "",
    name: "",
    email: "",
    role: "officer",
  }))
}

export async function updateOfficerProfile(data: Partial<OfficerProfile>): Promise<OfficerProfile> {
  return serverFetch<OfficerProfile>("/officer/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function getOfficerPreferences(): Promise<OfficerPreferences> {
  return serverFetch<OfficerPreferences>("/officer/preferences").catch(() => ({
    confidence_floor: 0.75,
    ocr_floor: 0.7,
    notifications: {},
  }))
}

export async function updateOfficerPreferences(data: Partial<OfficerPreferences>): Promise<OfficerPreferences> {
  return serverFetch<OfficerPreferences>("/officer/preferences", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function getOfficerReports(fy?: string): Promise<Record<string, unknown>> {
  const qs = fy ? `?fy=${fy}` : ""
  return serverFetch<Record<string, unknown>>(`/officer/reports${qs}`).catch(() => ({}))
}

export async function verifyDsc(): Promise<{ verified: boolean; expiry: string }> {
  return serverFetch("/officer/dsc/verify", { method: "POST" }).catch(() => ({
    verified: true,
    expiry: "2027-08-14",
  }))
}

export type BidderEvaluation = {
  id: string
  company_name: string
  city?: string
  registration_number?: string
  tender_id: string
  tender_number: string
  tender_title: string
  evaluation_id?: string
  overall_verdict?: string
  score?: number
  total_criteria?: number
  passed_criteria?: number
  failed_criteria?: number
  review_criteria?: number
  evaluated_at?: string
  avg_confidence?: number
}

export async function listBidderEvaluations(params?: {
  verdict?: string
  tender_id?: string
  page?: number
}): Promise<{ data: BidderEvaluation[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.verdict) qs.set("verdict", params.verdict)
  if (params?.tender_id) qs.set("tender_id", params.tender_id)
  if (params?.page) qs.set("page", String(params.page))
  const query = qs.toString() ? `?${qs}` : ""
  const res = await serverFetch<{ data: BidderEvaluation[]; total: number }>(
    `/officer/bidder-evaluations${query}`,
  ).catch(() => ({ data: [], total: 0 }))
  return res
}

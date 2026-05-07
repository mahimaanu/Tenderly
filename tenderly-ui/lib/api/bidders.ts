import { serverFetch } from "../auth/session"

export type BidderDoc = {
  id: string
  bidder_id: string
  filename: string
  document_type?: string
  kind?: string
  format?: string
  confidence_score?: number
  needs_review: boolean
  page_count?: number
  processed_at?: string
  created_at: string
}

export type Bidder = {
  id: string
  tender_id: string
  company_name: string
  contact_email?: string
  registration_number?: string
  city?: string
  phone?: string
  contact_person?: string
  status: string
  submitted_at?: string
  created_at: string
  overall_verdict?: string
  final_verdict?: string
  score?: number
  total_criteria?: number
  passed_criteria?: number
  failed_criteria?: number
  review_criteria?: number
}

export type Evaluation = {
  id: string
  tender_id: string
  bidder_id: string
  overall_verdict: string
  score?: number
  total_criteria: number
  passed_criteria: number
  failed_criteria: number
  review_criteria: number
  requires_manual_review: boolean
  review_completed: boolean
  final_verdict?: string
  evaluated_at: string
}

export type CriterionEvaluation = {
  id: string
  evaluation_id: string
  criterion_id: string
  verdict: string
  confidence?: number
  requirement: string
  bidder_value?: string
  comparison_detail?: string
  source_document?: string
  source_page?: number
  source_excerpt?: string
  reasoning: string
  review_reason?: string
  manually_reviewed: boolean
  manual_verdict?: string
  reviewer_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export async function listBidders(tenderId: string, params?: { verdict?: string; page?: number }): Promise<Bidder[]> {
  const qs = new URLSearchParams()
  if (params?.verdict) qs.set("verdict", params.verdict)
  if (params?.page) qs.set("page", String(params.page))
  const query = qs.toString() ? `?${qs}` : ""
  const res = await serverFetch<{ data: Bidder[] } | Bidder[]>(`/tenders/${tenderId}/bidders${query}`)
  return Array.isArray(res) ? res : (res as { data: Bidder[] }).data ?? []
}

export async function getBidder(tenderId: string, bidderId: string): Promise<Bidder> {
  return serverFetch<Bidder>(`/tenders/${tenderId}/bidders/${bidderId}`)
}

export async function getBidderDocuments(tenderId: string, bidderId: string): Promise<BidderDoc[]> {
  const res = await serverFetch<{ data: BidderDoc[] } | BidderDoc[]>(
    `/tenders/${tenderId}/bidders/${bidderId}/documents`,
  )
  return Array.isArray(res) ? res : (res as { data: BidderDoc[] }).data ?? []
}

export async function getBidderEvaluation(tenderId: string, bidderId: string): Promise<Evaluation | null> {
  return serverFetch<Evaluation>(`/tenders/${tenderId}/bidders/${bidderId}/evaluation`).catch(() => null)
}

export async function getCriterionEvaluations(tenderId: string, evaluationId: string): Promise<CriterionEvaluation[]> {
  const res = await serverFetch<{ data: CriterionEvaluation[] } | CriterionEvaluation[]>(
    `/tenders/${tenderId}/evaluations/${evaluationId}/criterion-evaluations`,
  )
  return Array.isArray(res) ? res : (res as { data: CriterionEvaluation[] }).data ?? []
}

export async function listAllBidders(params?: { q?: string; page?: number }): Promise<Bidder[]> {
  const qs = new URLSearchParams()
  if (params?.q) qs.set("q", params.q)
  if (params?.page) qs.set("page", String(params.page))
  const query = qs.toString() ? `?${qs}` : ""
  const res = await serverFetch<{ data: Bidder[] } | Bidder[]>(`/bidders${query}`).catch(() => [] as Bidder[])
  return Array.isArray(res) ? res : (res as { data: Bidder[] }).data ?? []
}

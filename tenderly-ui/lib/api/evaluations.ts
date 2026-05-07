import { serverFetch } from "../auth/session"

export type ManualReviewItem = {
  bidder_id: string
  company_name: string
  registration_number?: string
  city?: string
  tender_id: string
  tender_number: string
  tender_title: string
  evaluation_id?: string | null
  total_criteria?: number | null
  eligible_count?: number | null
  not_eligible_count?: number | null
  needs_review_count?: number | null
  pending_review_count?: number | null
  item_type: "criterion_review" | "unevaluated_bidder"
}

export async function getManualReviewQueue(params?: {
  page?: number
  count_only?: boolean
}): Promise<{ items: ManualReviewItem[]; total: number; count?: number }> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set("page", String(params.page))
  if (params?.count_only) qs.set("count_only", "1")
  const query = qs.toString() ? `?${qs}` : ""
  const res = await serverFetch<{
    items?: ManualReviewItem[]
    data?: ManualReviewItem[]
    total?: number
    count?: number
    meta?: { total?: number }
  }>(`/officer/manual-review${query}`).catch(() => ({ items: [], total: 0 }))
  const items = (res.items ?? res.data ?? []) as ManualReviewItem[]
  const total = res.total ?? res.meta?.total ?? items.length
  return { items, total, count: res.count ?? total }
}

export async function submitManualReview(
  criterionEvalId: string,
  data: { verdict: string; reviewer_notes?: string },
): Promise<void> {
  return serverFetch(`/tenders/criterion-evaluations/${criterionEvalId}/review`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function startEvaluation(tenderId: string): Promise<{ job_id: string; status: string }> {
  return serverFetch(`/tenders/${tenderId}/evaluate`, { method: "POST" })
}

export async function getJobStatus(jobId: string): Promise<{ status: string; progress_percent?: number; error?: unknown }> {
  return serverFetch(`/jobs/${jobId}`)
}

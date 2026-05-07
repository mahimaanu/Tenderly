import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  Building01Icon,
  Mail01Icon,
  Call02Icon,
  Download01Icon,
  EyeIcon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { CriterionCard } from "@/components/portal/criterion-card"
import { VerdictBadge } from "@/components/portal/verdict"
import { getBidder, getBidderEvaluation, getCriterionEvaluations, getBidderDocuments } from "@/lib/api/bidders"
import { getCriteria } from "@/lib/api/tenders"
import { ReviewActionButtons, NotifyBidderButton } from "@/components/portal/review-action-buttons"

export default async function BidderEvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bidderId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id, bidderId } = await params
  const { from } = await searchParams
  const fromReview = from === "review"

  const [bidder, evaluation, documents, criteria] = await Promise.all([
    getBidder(id, bidderId).catch(() => null),
    getBidderEvaluation(id, bidderId),
    getBidderDocuments(id, bidderId).catch(() => []),
    getCriteria(id).catch(() => []),
  ])

  if (!bidder) notFound()

  const criterionEvals = evaluation
    ? await getCriterionEvaluations(id, evaluation.id).catch(() => [])
    : []

  const overall = evaluation?.final_verdict ?? evaluation?.overall_verdict ?? null

  return (
    <>
      <PageHeader
        title={bidder.company_name}
        description={`Evaluation · ${bidder.registration_number ?? ""}`}
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              {fromReview ? (
                <Link href="/officer/manual-review">
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={13} /> Back to Review Queue
                </Link>
              ) : (
                <Link href={`/officer/tenders/${id}`}>
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={13} /> Back
                </Link>
              )}
            </Button>
            <NotifyBidderButton bidderId={bidderId} />
            <Button size="lg">
              <HugeiconsIcon icon={Download01Icon} size={13} /> Export
            </Button>
          </>
        }
        meta={
          <>
            {overall ? (
              <VerdictBadge verdict={mapVerdict(overall)} />
            ) : (
              <Badge variant="muted">Pending Evaluation</Badge>
            )}
            {evaluation?.score != null && (
              <span className="text-[11px] text-muted-foreground font-mono">Score: {Math.round(evaluation.score)}%</span>
            )}
          </>
        }
      />

      {/* Bidder info */}
      <Card className="mb-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem icon={Building01Icon} label="Company" value={bidder.company_name} />
          {bidder.city && <InfoItem icon={Building01Icon} label="City" value={bidder.city} />}
          {bidder.contact_email && <InfoItem icon={Mail01Icon} label="Email" value={bidder.contact_email} />}
          {bidder.phone && <InfoItem icon={Call02Icon} label="Phone" value={bidder.phone} />}
        </div>
      </Card>

      {/* Evaluation summary */}
      {evaluation && (
        <Card className="mb-4 p-5">
          <h3 className="font-heading text-sm font-semibold mb-3">Evaluation Summary</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Total Criteria" value={evaluation.total_criteria} />
            <StatBox label="Passed" value={evaluation.passed_criteria} color="text-success" />
            <StatBox label="Failed" value={evaluation.failed_criteria} color="text-danger" />
            <StatBox label="Review" value={evaluation.review_criteria} color="text-warning-foreground" />
          </div>
        </Card>
      )}

      {/* Per-criterion evaluations */}
      {criterionEvals.length > 0 && (
        <Card className="mb-4">
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Criterion-by-Criterion Evaluation</h3>
          </div>
          <div className="divide-y divide-border/60">
            {criterionEvals.map((ce) => {
              const criterion = criteria.find((c) => c.id === ce.criterion_id)
              return (
                <div key={ce.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="muted" className="text-[10px]">{criterion?.criterion_code ?? criterion?.type ?? "—"}</Badge>
                        <VerdictBadge verdict={mapVerdict(ce.verdict)} />
                        {ce.confidence != null && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {Math.round(ce.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{criterion?.description ?? ce.requirement}</p>
                      {ce.bidder_value && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Bidder value: <span className="font-mono">{ce.bidder_value}</span>
                        </p>
                      )}
                      {ce.reasoning && (
                        <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{ce.reasoning}</p>
                      )}
                      {ce.review_reason && (
                        <div className="mt-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
                          <p className="text-[11px] text-warning-foreground">
                            <span className="font-semibold">Review needed:</span> {ce.review_reason}
                          </p>
                        </div>
                      )}
                      {ce.source_document && (
                        <p className="text-[10.5px] text-muted-foreground mt-1 font-mono">
                          Source: {ce.source_document}{ce.source_page ? `, p.${ce.source_page}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {ce.verdict === "needs_review" && !ce.manually_reviewed && (
                        <ReviewActionButtons criterionEvalId={ce.id} />
                      )}
                      {ce.manually_reviewed && (
                        <span className="text-[11px] text-muted-foreground italic">Reviewed</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Submitted Documents</h3>
            <p className="text-muted-foreground text-[11px]">{documents.length} documents</p>
          </div>
          <ul className="divide-y divide-border/60">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <HugeiconsIcon icon={Attachment01Icon} size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.filename}</p>
                  <p className="text-muted-foreground text-[11px] font-mono">
                    {d.kind ?? d.document_type ?? ""}
                    {d.format ? ` · ${d.format}` : ""}
                    {d.page_count ? ` · ${d.page_count}p` : ""}
                    {d.confidence_score != null ? ` · OCR ${Math.round(d.confidence_score * 100)}%` : ""}
                    {d.needs_review ? " · ⚠ Needs review" : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon icon={EyeIcon} size={11} /> View
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function InfoItem({ icon, label, value }: { icon: unknown; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground mb-0.5">
        <HugeiconsIcon icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]} size={11} />
        {label}
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function StatBox({ label, value, color = "text-foreground" }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-3 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
      <div className={`font-mono text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  )
}

function mapVerdict(s: string): "eligible" | "ineligible" | "manual_review" {
  if (s === "not_eligible" || s === "ineligible") return "ineligible"
  if (s === "needs_review" || s === "manual_review") return "manual_review"
  return "eligible"
}

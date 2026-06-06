import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  Building01Icon,
  Mail01Icon,
  Call02Icon,
  Download01Icon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { VerdictBadge } from "@/components/portal/verdict"
import { ReviewActionButtons, NotifyBidderButton } from "@/components/portal/review-action-buttons"
import { DocumentViewerButton } from "@/components/portal/document-viewer"
import { getBidder, getTender } from "@/lib/mock-data"

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

  const bidder = getBidder(id, bidderId)
  if (!bidder) notFound()

  const tender = getTender(id)
  const criteria = tender?.criteria ?? []

  const passed = bidder.evaluations.filter((e) => e.verdict === "eligible").length
  const failed = bidder.evaluations.filter((e) => e.verdict === "ineligible").length
  const review = bidder.evaluations.filter((e) => e.verdict === "manual_review").length

  return (
    <>
      <PageHeader
        title={bidder.name}
        description={`Evaluation · ${bidder.registrationNo}`}
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
            <VerdictBadge verdict={bidder.overall} />
            <span className="text-[11px] text-muted-foreground font-mono">Score: {bidder.score}%</span>
          </>
        }
      />

      {/* Bidder info */}
      <Card className="mb-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem icon={Building01Icon} label="Company" value={bidder.name} />
          <InfoItem icon={Building01Icon} label="City" value={bidder.city} />
          <InfoItem icon={Mail01Icon} label="Email" value={bidder.email} />
          <InfoItem icon={Call02Icon} label="Phone" value={bidder.phone} />
        </div>
      </Card>

      {/* Evaluation summary */}
      <Card className="mb-4 p-5">
        <h3 className="font-heading text-sm font-semibold mb-3">Evaluation Summary</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Total Criteria" value={bidder.evaluations.length} />
          <StatBox label="Passed" value={passed} color="text-success" />
          <StatBox label="Failed" value={failed} color="text-danger" />
          <StatBox label="Review" value={review} color="text-warning-foreground" />
        </div>
      </Card>

      {/* Per-criterion evaluations */}
      {bidder.evaluations.length > 0 && (
        <Card className="mb-4">
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Criterion-by-Criterion Evaluation</h3>
          </div>
          <div className="divide-y divide-border/60">
            {bidder.evaluations.map((ce) => {
              const criterion = criteria.find((c) => c.id === ce.criterionId)
              return (
                <div key={ce.criterionId} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="muted" className="text-[10px]">{criterion?.code ?? criterion?.type ?? "—"}</Badge>
                        <VerdictBadge verdict={ce.verdict} />
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {Math.round(ce.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-sm font-medium">{criterion?.title ?? criterion?.requirement}</p>
                      {ce.extractedValue && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Bidder value: <span className="font-mono">{ce.extractedValue}</span>
                        </p>
                      )}
                      {ce.rationale && (
                        <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{ce.rationale}</p>
                      )}
                      {ce.reviewReason && (
                        <div className="mt-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
                          <p className="text-[11px] text-warning-foreground">
                            <span className="font-semibold">Review needed:</span> {ce.reviewReason}
                          </p>
                        </div>
                      )}
                      {ce.pageReference && (
                        <p className="text-[10.5px] text-muted-foreground mt-1 font-mono">
                          Source: {ce.pageReference}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {ce.verdict === "manual_review" && (
                        <ReviewActionButtons criterionEvalId={ce.criterionId} />
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
      {bidder.documents.length > 0 && (
        <Card>
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Submitted Documents</h3>
            <p className="text-muted-foreground text-[11px]">{bidder.documents.length} documents</p>
          </div>
          <ul className="divide-y divide-border/60">
            {bidder.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <HugeiconsIcon icon={Attachment01Icon} size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-muted-foreground text-[11px] font-mono">
                    {d.kind}
                    {d.format ? ` · ${d.format}` : ""}
                    {d.pages ? ` · ${d.pages}p` : ""}
                    {d.ocrConfidence != null ? ` · OCR ${Math.round(d.ocrConfidence * 100)}%` : ""}
                  </p>
                </div>
                <DocumentViewerButton doc={d} />
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

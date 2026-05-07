import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { RunEvalButton } from "@/components/portal/review-action-buttons"
import { getManualReviewQueue } from "@/lib/api/evaluations"
import type { ManualReviewItem } from "@/lib/api/evaluations"

export default async function ManualReviewQueue() {
  const { items, total } = await getManualReviewQueue().catch(() => ({ items: [], total: 0 }))

  const criterionItems = items.filter((i) => i.item_type === "criterion_review")
  const unevaluatedItems = items.filter((i) => i.item_type === "unevaluated_bidder")

  return (
    <>
      <PageHeader
        title="Manual Review Queue"
        description="Bids that require officer review — either the AI flagged ambiguity in criteria or the bid has not been evaluated yet."
        meta={
          <Badge variant={total > 0 ? "warning" : "success"}>
            <HugeiconsIcon icon={AlertCircleIcon} size={10} />
            {total} {total === 1 ? "bid" : "bids"} pending
          </Badge>
        }
      />

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} className="text-success mx-auto mb-2" />
          <p className="text-sm font-medium text-success">All clear — no bids need manual review right now.</p>
        </Card>
      ) : (
        <div className="space-y-6">

          {/* ── Needs review ─────────────────────────────────────────────── */}
          {criterionItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-heading text-sm font-semibold">Needs Review</h2>
                <Badge variant="warning" className="text-[10px]">{criterionItems.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {criterionItems.map((item) => (
                  <NeedsReviewCard key={item.bidder_id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* ── Awaiting evaluation ───────────────────────────────────────── */}
          {unevaluatedItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-heading text-sm font-semibold">Awaiting Evaluation</h2>
                <Badge variant="muted" className="text-[10px]">{unevaluatedItems.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {unevaluatedItems.map((item) => (
                  <UnevaluatedCard key={item.bidder_id} item={item} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </>
  )
}

function NeedsReviewCard({ item }: { item: ManualReviewItem }) {
  const eligible = item.eligible_count ?? 0
  const notEligible = item.not_eligible_count ?? 0
  const pending = item.pending_review_count ?? 0

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="warning">
              <HugeiconsIcon icon={AlertCircleIcon} size={10} />
              Needs Review
            </Badge>
            <span className="text-[11px] text-muted-foreground font-mono">
              {item.tender_number}
            </span>
          </div>
          <h3 className="text-sm font-semibold">{item.company_name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{item.tender_title}</p>
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-success font-medium">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={11} /> {eligible} eligible
            </span>
            <span className="inline-flex items-center gap-1 text-danger font-medium">
              <HugeiconsIcon icon={Cancel01Icon} size={11} /> {notEligible} not eligible
            </span>
            <span className="inline-flex items-center gap-1 text-warning-foreground font-medium">
              <HugeiconsIcon icon={AlertCircleIcon} size={11} /> {pending} needs review
            </span>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`/officer/tenders/${item.tender_id}/bidders/${item.bidder_id}?from=review`}>
            Review <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function UnevaluatedCard({ item }: { item: ManualReviewItem }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="muted">
              <HugeiconsIcon icon={Clock01Icon} size={10} />
              Not Evaluated
            </Badge>
            <span className="text-[11px] text-muted-foreground font-mono">
              {item.tender_number}
            </span>
          </div>
          <h3 className="text-sm font-semibold">{item.company_name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{item.tender_title}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Documents submitted — not yet matched against eligibility criteria.
          </p>
        </div>
        <RunEvalButton bidderId={item.bidder_id} tenderId={item.tender_id} />
      </div>
    </Card>
  )
}

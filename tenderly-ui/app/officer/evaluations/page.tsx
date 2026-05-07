import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Building01Icon,
  Analytics02Icon,
} from "@hugeicons/core-free-icons"
import { PageHeader } from "@/components/portal/header"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VerdictBadge } from "@/components/portal/verdict"
import { listBidderEvaluations } from "@/lib/api/officer"
import type { Verdict } from "@/lib/types"
import { fmtDate } from "@/lib/utils"

export default async function BidderEvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ verdict?: string; page?: string }>
}) {
  const sp = await searchParams
  const page = Number(sp.page ?? 1)
  const verdictFilter = sp.verdict ?? ""

  const { data: rows, total } = await listBidderEvaluations({
    verdict: verdictFilter || undefined,
    page,
  }).catch(() => ({ data: [], total: 0 }))

  const verdictCounts = {
    eligible: rows.filter((r) => r.overall_verdict === "eligible").length,
    not_eligible: rows.filter((r) => r.overall_verdict === "not_eligible").length,
    needs_review: rows.filter((r) => r.overall_verdict === "needs_review").length,
    unevaluated: rows.filter((r) => !r.overall_verdict).length,
  }

  return (
    <>
      <PageHeader
        title="Bidder Evaluations"
        description="All bidder evaluations across every tender — verdict, score, and confidence."
        meta={<Badge variant="muted"><HugeiconsIcon icon={Analytics02Icon} size={10} />{total} total</Badge>}
      />

      {/* Summary chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip href="/officer/evaluations" active={!verdictFilter} label="All" count={total} />
        <FilterChip href="/officer/evaluations?verdict=eligible" active={verdictFilter === "eligible"} label="Eligible" count={verdictCounts.eligible} tone="success" />
        <FilterChip href="/officer/evaluations?verdict=not_eligible" active={verdictFilter === "not_eligible"} label="Not Eligible" count={verdictCounts.not_eligible} tone="danger" />
        <FilterChip href="/officer/evaluations?verdict=needs_review" active={verdictFilter === "needs_review"} label="Needs Review" count={verdictCounts.needs_review} tone="warning" />
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No bidder evaluations found.{" "}
          <Link href="/officer/tenders" className="text-primary hover:underline">Start an evaluation from a tender →</Link>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3 hidden md:table-cell">Tender</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">Score</th>
                  <th className="px-4 py-3 text-center hidden lg:table-cell">Criteria</th>
                  <th className="px-4 py-3 text-center hidden lg:table-cell">Avg Confidence</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Evaluated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((r, i) => {
                  const verdict = mapVerdict(r.overall_verdict ?? "")
                  const confidence = r.avg_confidence != null ? Math.round(Number(r.avg_confidence) * 100) : null
                  return (
                    <tr key={r.id ?? i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[180px]">{r.company_name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          {r.city && <><HugeiconsIcon icon={Building01Icon} size={10} />{r.city}</>}
                          {r.registration_number && <span className="font-mono ml-1">{r.registration_number}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="truncate max-w-[200px] text-[12px]">{r.tender_title}</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">{r.tender_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.overall_verdict ? (
                          <VerdictBadge verdict={verdict} size="sm" />
                        ) : (
                          <Badge variant="warning" className="text-[10px]">Needs Evaluation</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {r.score != null ? (
                          <span className={`font-mono text-sm font-semibold tabular-nums ${scoreColor(Number(r.score))}`}>
                            {Math.round(Number(r.score))}%
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {r.total_criteria ? (
                          <div className="flex items-center justify-center gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-0.5 text-success font-medium">
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={11} />{r.passed_criteria ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-danger font-medium">
                              <HugeiconsIcon icon={Cancel01Icon} size={11} />{r.failed_criteria ?? 0}
                            </span>
                            {(r.review_criteria ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-warning-foreground font-medium">
                                <HugeiconsIcon icon={AlertCircleIcon} size={11} />{r.review_criteria}
                              </span>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-xs text-center block">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {confidence != null ? (
                          <ConfidenceBar value={confidence} />
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                        {r.evaluated_at ? fmtDate(r.evaluated_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.overall_verdict ? (
                          <Link
                            href={`/officer/tenders/${r.tender_id}/bidders/${r.id}`}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            View <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
                          </Link>
                        ) : (
                          <Link
                            href="/officer/manual-review"
                            className="inline-flex items-center gap-1 text-[11px] text-warning-foreground hover:underline font-medium"
                          >
                            Review <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > 50 && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-[12px] text-muted-foreground">
              <span>Showing {Math.min(page * 50, total)} of {total}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/officer/evaluations?${verdictFilter ? `verdict=${verdictFilter}&` : ""}page=${page - 1}`}
                    className="text-primary hover:underline">← Prev</Link>
                )}
                {page * 50 < total && (
                  <Link href={`/officer/evaluations?${verdictFilter ? `verdict=${verdictFilter}&` : ""}page=${page + 1}`}
                    className="text-primary hover:underline">Next →</Link>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  )
}

function FilterChip({
  href, active, label, count, tone,
}: {
  href: string
  active: boolean
  label: string
  count: number
  tone?: "success" | "danger" | "warning"
}) {
  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
  const activeClass = tone === "success"
    ? "border-success bg-success/10 text-success"
    : tone === "danger"
    ? "border-danger bg-danger/10 text-danger"
    : tone === "warning"
    ? "border-warning bg-warning/10 text-warning-foreground"
    : "border-primary bg-primary/10 text-primary"
  const idleClass = "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"

  return (
    <Link href={href} className={`${base} ${active ? activeClass : idleClass}`}>
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-white/20" : "bg-muted"}`}>
        {count}
      </span>
    </Link>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-danger"
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-[11px] font-semibold tabular-nums">{value}%</span>
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function mapVerdict(v: string): Verdict {
  if (v === "not_eligible") return "ineligible"
  if (v === "needs_review") return "manual_review"
  return "eligible"
}

function scoreColor(score: number) {
  if (score >= 75) return "text-success"
  if (score >= 50) return "text-warning-foreground"
  return "text-danger"
}

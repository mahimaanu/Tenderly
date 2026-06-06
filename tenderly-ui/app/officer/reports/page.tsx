import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Download01Icon,
  Analytics02Icon,
  AiBrain01Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { VerdictDot } from "@/components/portal/verdict"
import { StackedBarChart, BarChart } from "@/components/charts/bars"
import { sampleTender, verdictCounts } from "@/lib/mock-data"

export default function ReportsPage() {
  const bidders = sampleTender.bidders
  const counts = verdictCounts(sampleTender)
  const total = bidders.length

  // Per-criterion pass/fail/review breakdown
  const criterionStats = sampleTender.criteria.map((c) => {
    const evals = bidders.map((b) => b.evaluations.find((e) => e.criterionId === c.id)!)
    const eligible = evals.filter((e) => e?.verdict === "eligible").length
    const ineligible = evals.filter((e) => e?.verdict === "ineligible").length
    const review = evals.filter((e) => e?.verdict === "manual_review").length
    return { code: c.code, title: c.title, eligible, ineligible, review }
  })

  // Avg confidence across all criterion evaluations
  const allEvals = bidders.flatMap((b) => b.evaluations)
  const avgConfidence = Math.round((allEvals.reduce((s, e) => s + e.confidence, 0) / allEvals.length) * 100)

  // Document stats
  const allDocs = bidders.flatMap((b) => b.documents)
  const lowOcrDocs = allDocs.filter((d) => d.ocrConfidence != null && d.ocrConfidence < 0.6)

  // Bidder score data for bar chart
  const scoreData = bidders.map((b) => ({ label: b.name.split(" ")[0], value: b.score }))

  const barRows = criterionStats.map((c) => ({
    label: c.code,
    meta: (
      <span className="tabular-nums">
        <span className="text-success">{c.eligible}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-danger">{c.ineligible}</span>
        {c.review > 0 && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-warning-foreground">{c.review}</span>
          </>
        )}
      </span>
    ),
    values: [
      { color: "var(--success)", value: c.eligible },
      { color: "var(--danger)", value: c.ineligible },
      { color: "var(--warning)", value: c.review },
    ],
  }))

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Detailed evaluation analytics across all tenders."
        actions={
          <Button size="lg">
            <HugeiconsIcon icon={Download01Icon} size={13} /> Export PDF
          </Button>
        }
      />

      {/* Bidder score distribution */}
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={Analytics02Icon} size={14} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Bidder Score Distribution</h3>
        </div>
        <BarChart data={scoreData} height={140} color="var(--primary)" />
        <div className="mt-4 divide-y divide-border/50">
          {bidders.map((b) => (
            <Link
              key={b.id}
              href={`/officer/tenders/${sampleTender.id}/bidders/${b.id}`}
              className="flex items-center gap-3 py-2 hover:bg-muted/40 -mx-1 px-1 rounded"
            >
              <VerdictDot verdict={b.overall} />
              <span className="text-[11px] flex-1 truncate">{b.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{b.score}%</span>
              <HugeiconsIcon icon={ArrowRight02Icon} size={11} className="text-muted-foreground" />
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Criteria pass rates */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <HugeiconsIcon icon={Analytics02Icon} size={14} className="text-primary" />
            <h3 className="font-heading text-sm font-semibold">Criteria Pass Rates</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-5">
            Per-criterion verdict counts —{" "}
            <span className="text-success font-medium">eligible</span>
            {" / "}
            <span className="text-danger font-medium">ineligible</span>
            {" / "}
            <span className="text-warning-foreground font-medium">review</span>
          </p>
          <StackedBarChart rows={barRows} max={total} />
          <div className="mt-4 divide-y divide-border/50">
            {criterionStats.map((c) => (
              <div key={c.code} className="flex items-baseline justify-between py-2 text-[11px]">
                <span className="font-mono text-muted-foreground w-14 shrink-0">{c.code}</span>
                <span className="text-foreground flex-1 truncate">{c.title}</span>
                <span className="font-mono ml-4 shrink-0">
                  {Math.round((c.eligible / total) * 100)}% passed
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* AI efficiency */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <HugeiconsIcon icon={AiBrain01Icon} size={14} className="text-primary" />
            <h3 className="font-heading text-sm font-semibold">AI Evaluation Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Documents parsed", value: String(allDocs.length) },
              { label: "Avg. AI confidence", value: `${avgConfidence}%` },
              { label: "Automated decisions", value: String(counts.eligible + counts.ineligible) },
              { label: "Low-quality scans", value: String(lowOcrDocs.length) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/50 p-3">
                <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide font-medium">{item.label}</div>
                <div className="font-mono text-lg font-bold mt-1">{item.value}</div>
              </div>
            ))}
          </div>

          {lowOcrDocs.length > 0 && (
            <div>
              <p className="text-[11px] font-medium mb-2 text-muted-foreground uppercase tracking-wide">Low-confidence documents</p>
              <ul className="space-y-1.5">
                {lowOcrDocs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-[11px]">
                    <span className="inline-block size-1.5 rounded-full bg-warning shrink-0" />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="font-mono text-warning-foreground shrink-0">
                      {Math.round((d.ocrConfidence ?? 0) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

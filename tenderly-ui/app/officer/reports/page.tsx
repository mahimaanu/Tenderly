import { HugeiconsIcon } from "@hugeicons/react"
import {
  Download01Icon,
  Analytics02Icon,
  AiBrain01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { DonutChart, DonutLegend } from "@/components/charts/donut"
import { getOfficerReports } from "@/lib/api/officer"

export default async function ReportsPage() {
  const report = await getOfficerReports().catch(() => null) as Record<string, unknown> | null

  const eligible = Number(report?.eligible ?? 0)
  const ineligible = Number(report?.ineligible ?? 0)
  const review = Number(report?.needs_review ?? 0)
  const total = eligible + ineligible + review

  const donutData = [
    { label: "Eligible", value: eligible, color: "var(--success)" },
    { label: "Not Eligible", value: ineligible, color: "var(--danger)" },
    { label: "Manual Review", value: review, color: "var(--warning)" },
  ]

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Aggregate evaluation statistics across all tenders."
        actions={
          <Button size="lg">
            <HugeiconsIcon icon={Download01Icon} size={13} /> Export PDF
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
        <StatBox icon={CheckmarkCircle02Icon} label="Eligible" value={eligible} tone="text-success" />
        <StatBox icon={AlertCircleIcon} label="Manual Review" value={review} tone="text-warning-foreground" />
        <StatBox icon={Cancel01Icon} label="Ineligible" value={ineligible} tone="text-danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <HugeiconsIcon icon={Analytics02Icon} size={14} className="text-primary" />
            <h3 className="font-heading text-sm font-semibold">Verdict Mix</h3>
          </div>
          {total > 0 ? (
            <>
              <div className="flex items-center justify-center mb-4">
                <DonutChart data={donutData} centerValue={total} centerLabel="total evaluated" />
              </div>
              <DonutLegend data={donutData} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No evaluations yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <HugeiconsIcon icon={AiBrain01Icon} size={14} className="text-primary" />
            <h3 className="font-heading text-sm font-semibold">AI-assisted time savings</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Documents parsed", value: String(report?.documents_parsed ?? "—") },
              { label: "Avg. evaluation time", value: String(report?.avg_eval_time ?? "—") },
              { label: "Manual reviews needed", value: String(review) },
              { label: "Automated decisions", value: String(eligible + ineligible) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/50 p-3">
                <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide font-medium">{item.label}</div>
                <div className="font-mono text-lg font-bold mt-1">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

function StatBox({ icon, label, value, tone }: { icon: unknown; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-2">
        <HugeiconsIcon icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]} size={12} />
        {label}
      </div>
      <div className={`font-mono text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  )
}

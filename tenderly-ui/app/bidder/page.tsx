import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Clock01Icon,
  Attachment01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons"
import { PageHeader } from "@/components/portal/header"
import { StatCard } from "@/components/portal/stat-card"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerdictBadge } from "@/components/portal/verdict"
import { getBidderDashboard } from "@/lib/api/bidder-api"
import { fmtDate } from "@/lib/utils"

export default async function BidderDashboard() {
  const dash = await getBidderDashboard().catch(() => null) as Record<string, unknown> | null

  const stats = (dash?.stats ?? {}) as Record<string, unknown>
  const inFlight = Number(stats?.in_flight ?? 0)
  const drafts = Number(stats?.drafts ?? 0)
  const actionsRequired = Number(stats?.actions_required ?? 0)
  const inFlightSub = dash?.in_flight_submission as Record<string, unknown> | null ?? null
  const recommended = (dash?.recommended_tenders ?? []) as Record<string, unknown>[]
  const pastBids = (dash?.past_bids ?? []) as Record<string, unknown>[]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Track your bid submissions and discover new tenders."
        actions={
          <Button size="lg" asChild>
            <Link href="/bidder/tenders">
              <HugeiconsIcon icon={PlusSignIcon} size={14} /> Browse Tenders
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
        <StatCard label="In-Flight Submissions" value={inFlight} icon={Clock01Icon} tone="primary" hint="actively submitted" />
        <StatCard label="Drafts" value={drafts} icon={Attachment01Icon} tone="info" hint="in progress" />
        <StatCard label="Actions Required" value={actionsRequired} icon={AlertCircleIcon} tone="warning" hint="clarifications & re-uploads" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* In-flight submission */}
        <Card className="lg:col-span-7 p-5">
          <h3 className="font-heading text-sm font-semibold mb-3">Current Submission</h3>
          {inFlightSub ? (
            <div>
              <p className="text-sm font-medium">{String(inFlightSub.title ?? "")}</p>
              <p className="text-muted-foreground text-[11px] font-mono mt-0.5">{String(inFlightSub.tender_number ?? "")}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant={submissionVariant(String(inFlightSub.status ?? ""))}>
                  {String(inFlightSub.status ?? "")}
                </Badge>
                {inFlightSub.submitted_at && (
                  <span className="text-[11px] text-muted-foreground">
                    Submitted {fmtDate(String(inFlightSub.submitted_at))}
                  </span>
                )}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={`/bidder/submissions/${inFlightSub.id}`}>
                  Track <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">No active submission yet.</p>
              <Button asChild size="sm">
                <Link href="/bidder/tenders">Browse open tenders</Link>
              </Button>
            </div>
          )}
        </Card>

        {/* Recommended tenders */}
        <Card className="lg:col-span-5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-sm font-semibold">Recommended Tenders</h3>
            <Button asChild variant="outline" size="sm">
              <Link href="/bidder/tenders">All <HugeiconsIcon icon={ArrowRight02Icon} size={11} /></Link>
            </Button>
          </div>
          {recommended.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tenders available.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recommended.map((t, i) => (
                <li key={String(t.id ?? i)}>
                  <Link href={`/bidder/tenders/${t.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{String(t.title ?? "")}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {String(t.category ?? "")} {t.closing_on ? `· Closes ${fmtDate(String(t.closing_on))}` : ""}
                      </p>
                    </div>
                    <HugeiconsIcon icon={ArrowRight02Icon} size={12} className="text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Past bids */}
      {pastBids.length > 0 && (
        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-sm font-semibold">Past Submissions</h3>
            <Button asChild variant="outline" size="sm">
              <Link href="/bidder/submissions">All <HugeiconsIcon icon={ArrowRight02Icon} size={11} /></Link>
            </Button>
          </div>
          <ul className="divide-y divide-border/60">
            {pastBids.map((b, i) => (
              <li key={String(b.id ?? i)}>
                <Link href={`/bidder/submissions/${b.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{String(b.title ?? b.tender_number ?? "")}</p>
                    {b.submitted_at && (
                      <p className="text-muted-foreground text-[11px]">Submitted {fmtDate(String(b.submitted_at))}</p>
                    )}
                  </div>
                  <Badge variant={submissionVariant(String(b.status ?? ""))}>{String(b.status ?? "")}</Badge>
                  <HugeiconsIcon icon={ArrowRight02Icon} size={12} className="text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function submissionVariant(s: string): "success" | "info" | "muted" | "saffron" | "warning" {
  if (s === "submitted") return "info"
  if (s === "draft") return "muted"
  if (s === "signed") return "saffron"
  return "muted"
}


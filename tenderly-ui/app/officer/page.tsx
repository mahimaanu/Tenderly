import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Folder01Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  ArrowRight02Icon,
  Clock01Icon,
  Building01Icon,
  AiBrain01Icon,
  CloudUploadIcon,
  TimelineIcon,
  Analytics02Icon,
  UserMultiple02Icon,
  Calendar03Icon,
  Award01Icon,
  Note02Icon,
} from "@hugeicons/core-free-icons"
import { PageHeader } from "@/components/portal/header"
import { StatCard } from "@/components/portal/stat-card"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DonutChart, DonutLegend } from "@/components/charts/donut"
import { VerdictBadge, VerdictDot } from "@/components/portal/verdict"
import { NewTenderModal } from "@/components/portal/new-tender-modal"
import { getOfficerDashboard } from "@/lib/api/officer"
import { listTenders } from "@/lib/api/tenders"
import { fmtDateTime } from "@/lib/utils"

export default async function OfficerDashboard() {
  const [dashboard, tenders] = await Promise.all([
    getOfficerDashboard().catch(() => null),
    listTenders().catch(() => []),
  ])

  const stats = dashboard?.stats ?? { active_tenders: 0, bids_received: 0, eligible: 0, ineligible: 0, needs_review: 0 }
  const headline = dashboard?.headline_tender as Record<string, unknown> | null ?? null
  const recentBidders = (dashboard?.recent_bidders ?? []) as Record<string, unknown>[]
  const recentActivity = (dashboard?.recent_activity ?? []) as Record<string, unknown>[]
  const userName = dashboard?.user?.name ?? "Officer"

  const eligible = stats.eligible
  const ineligible = stats.ineligible
  const review = stats.needs_review
  const totalEval = eligible + ineligible + review

  const donutData = [
    { label: "Eligible", value: eligible, color: "var(--success)" },
    { label: "Not Eligible", value: ineligible, color: "var(--danger)" },
    { label: "Manual Review", value: review, color: "var(--warning)" },
  ]

  // Compute once at request time — avoids hydration mismatch when the date
  // string is passed as a JSX prop into the client-component boundary
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", weekday: "short",
  })

  return (
    <>
      <PageHeader
        title={<span>Welcome back, <span className="text-primary">{String(userName).replace("Insp. ", "")}</span></span>}
        description="Officer dashboard — real-time data from the evaluation engine."
        actions={
          <>
            <NewTenderModal />
            {/* <Button size="lg">
              <HugeiconsIcon icon={CloudUploadIcon} size={14} />
              Upload Bid Set
            </Button> */}
          </>
        }
        meta={
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <HugeiconsIcon icon={Calendar03Icon} size={12} strokeWidth={1.7} />
            {todayLabel}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Tenders" value={stats.active_tenders} hint="draft + open + evaluating" icon={Folder01Icon} tone="primary" />
        <StatCard label="Bids Received" value={stats.bids_received} hint="across all tenders" icon={UserMultiple02Icon} tone="info" />
        <StatCard label="Eligible Bids" value={eligible} hint={totalEval > 0 ? `${Math.round((eligible / totalEval) * 100)}% of evaluated` : "—"} icon={CheckmarkCircle02Icon} tone="success" />
        <StatCard label="Needs Your Review" value={review} hint="Open in Manual Review queue" icon={AlertCircleIcon} tone="warning" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Headline tender */}
        {headline ? (
          <Card className="lg:col-span-7">
            <div className="flex items-start justify-between gap-3 p-5 pb-3">
              <div className="min-w-0">
                <Badge variant="info" className="mb-2">
                  <HugeiconsIcon icon={AiBrain01Icon} size={11} strokeWidth={1.8} />
                  Currently under evaluation
                </Badge>
                <h2 className="font-heading text-base font-semibold leading-tight">{String(headline.title ?? "")}</h2>
                <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                  {String(headline.tender_number ?? "")} · {String(headline.estimated_value ?? "")}
                </p>
              </div>
              <Button asChild>
                <Link href={`/officer/tenders/${headline.id}`}>
                  Open <HugeiconsIcon icon={ArrowRight02Icon} size={13} />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-5 px-5 pb-5 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex items-center justify-center">
                <DonutChart data={donutData} centerValue={totalEval} centerLabel="bidders evaluated" />
              </div>
              <div>
                <DonutLegend data={donutData} />
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-xs">
                  <div>
                    <div className="text-muted-foreground text-[10.5px] tracking-wide font-medium uppercase">Status</div>
                    <div className="font-mono mt-0.5 text-sm font-semibold">{String(headline.status ?? "")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10.5px] tracking-wide font-medium uppercase">Eligible count</div>
                    <div className="font-mono mt-0.5 text-sm font-semibold tabular-nums">{String(headline.eligible_count ?? eligible)}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-7 flex items-center justify-center p-8 text-muted-foreground text-sm">
            No tender currently under evaluation.{" "}
            <Link href="/officer/tenders" className="ml-1 text-primary hover:underline">View all tenders →</Link>
          </Card>
        )}

        {/* Verdict mix summary */}
        <Card className="lg:col-span-5">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h3 className="font-heading text-sm font-semibold">Evaluation summary</h3>
              <p className="text-muted-foreground text-[11px]">All tenders · cumulative</p>
            </div>
            <Badge variant="muted">
              <HugeiconsIcon icon={Analytics02Icon} size={10} />
              Live
            </Badge>
          </div>
          <div className="px-5 pb-5 flex items-center justify-center">
            {totalEval > 0 ? (
              <DonutChart data={donutData} centerValue={totalEval} centerLabel="total evaluated" />
            ) : (
              <p className="text-muted-foreground text-sm py-8">No evaluations yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent bidders + activity */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h3 className="font-heading text-sm font-semibold">Recent bidder evaluations</h3>
              <p className="text-muted-foreground text-[11px]">Latest 5 across all tenders</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/officer/evaluations">View all <HugeiconsIcon icon={ArrowRight02Icon} size={11} /></Link>
            </Button>
          </div>
          {recentBidders.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No bidder evaluations yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentBidders.map((b, i) => (
                <li key={String(b.id ?? i)}>
                  <Link
                    href={`/officer/tenders/${b.tender_id}/bidders/${b.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40"
                  >
                    {mapVerdict(String(b.overall_verdict ?? "")) ? (
                      <VerdictDot verdict={mapVerdict(String(b.overall_verdict ?? ""))!} />
                    ) : (
                      <span className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/30" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{String(b.company_name ?? "")}</span>
                        {b.city && <span className="text-muted-foreground text-[11px]">· {String(b.city)}</span>}
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-[11px]">
                        <span className="font-mono">{String(b.registration_number ?? "")}</span>
                        <span>·</span>
                        <span className="font-mono">{String(b.tender_title ?? b.tender_number ?? "")}</span>
                      </div>
                    </div>
                    {b.score != null && (
                      <span className="hidden text-right md:block">
                        <div className="text-[10.5px] text-muted-foreground">Score</div>
                        <div className="font-mono text-sm font-semibold tabular-nums">{Math.round(Number(b.score))}%</div>
                      </span>
                    )}
                    {mapVerdict(String(b.overall_verdict ?? "")) ? (
                      <VerdictBadge verdict={mapVerdict(String(b.overall_verdict ?? ""))!} />
                    ) : (
                      <Badge variant="muted" className="text-[10px]">Pending</Badge>
                    )}
                    <HugeiconsIcon icon={ArrowRight02Icon} size={13} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-5">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h3 className="font-heading text-sm font-semibold">Recent activity</h3>
              <p className="text-muted-foreground text-[11px]">Audit-grade event log</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/officer/audit">Full audit trail <HugeiconsIcon icon={TimelineIcon} size={11} /></Link>
            </Button>
          </div>
          {recentActivity.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-0.5 px-5 pb-5">
              {recentActivity.map((e, i) => (
                <li key={String(e.id ?? i)} className="relative flex gap-3 py-2 pl-5">
                  <span className="bg-border absolute top-0 left-1.5 h-full w-px" />
                  <span className={`absolute top-3.5 left-1 grid size-2 place-items-center rounded-full ${roleColor(String(e.actor_role ?? "system"))}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug">
                      <span className="font-medium">{String(e.action ?? "")}</span>{" "}
                      <span className="text-muted-foreground">— {String(e.target_type ?? "")} {String(e.target_id ?? "").slice(0, 8)}</span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[10.5px]">
                      <span className="font-mono">{formatTime(String(e.timestamp ?? ""))}</span> · {String(e.actor_label ?? "")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Tenders list */}
      <Card className="mt-5">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="font-heading text-sm font-semibold">All tenders</h3>
            <p className="text-muted-foreground text-[11px]">{tenders.length} total</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/officer/tenders">Manage tenders <HugeiconsIcon icon={ArrowRight02Icon} size={11} /></Link>
          </Button>
        </div>
        {tenders.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No tenders yet. Create your first tender.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-3">
            {tenders.slice(0, 6).map((t) => (
              <Link key={t.id} href={`/officer/tenders/${t.id}`}
                className="group rounded-lg border border-border/70 bg-background/50 p-4 hover:border-primary/30 hover:bg-card">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={statusVariant(t.status)}>
                    <HugeiconsIcon icon={t.status === "active" ? Clock01Icon : t.status === "evaluation" ? AiBrain01Icon : Award01Icon} size={10} />
                    {statusLabel(t.status)}
                  </Badge>
                  <span className="text-muted-foreground font-mono text-[10px]">{t.tender_number}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{t.title}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">{t.category ?? ""} {t.estimated_value ? `· ${t.estimated_value}` : ""}</p>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px]">
                  <span className="text-muted-foreground">{t.issuing_authority ?? ""}</span>
                  <span className="text-primary font-medium opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

function mapVerdict(v: string): "eligible" | "ineligible" | "manual_review" | null {
  if (v === "not_eligible") return "ineligible"
  if (v === "needs_review") return "manual_review"
  if (v === "eligible") return "eligible"
  return null  // not yet evaluated — caller renders a "Pending" fallback
}

function roleColor(role: string) {
  return role === "system" ? "bg-info" : role === "officer" ? "bg-primary" : "bg-saffron"
}

function statusLabel(s: string) {
  const map: Record<string, string> = { draft: "Draft", active: "Open", evaluation: "Evaluating", completed: "Completed" }
  return map[s] ?? s
}

function statusVariant(s: string): "success" | "info" | "muted" | "saffron" {
  if (s === "active") return "info"
  if (s === "evaluation") return "saffron"
  if (s === "completed") return "success"
  return "muted"
}

function formatTime(iso: string) {
  return fmtDateTime(iso)
}

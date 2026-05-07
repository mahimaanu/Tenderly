import { HugeiconsIcon } from "@hugeicons/react"
import {
  Download01Icon,
  FilterIcon,
  FingerPrintIcon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { getAuditFeed, getHeadHash } from "@/lib/api/audit"
import { fmtDateTime } from "@/lib/utils"

export default async function AuditTrail() {
  const [auditPage, headHash] = await Promise.all([
    getAuditFeed({ page_size: 50 }),
    getHeadHash(),
  ])

  const events = auditPage.data
  const system = events.filter((e) => e.actor_role === "system").length
  const officer = events.filter((e) => e.actor_role === "officer").length

  return (
    <>
      <PageHeader
        title="Audit Trail"
        description="A tamper-evident record of every system and human action. Suitable for CAG audit and right-to-information disclosure."
        actions={
          <>
            <Button variant="outline" size="lg">
              <HugeiconsIcon icon={FilterIcon} size={13} />
              Filter
            </Button>
            <Button size="lg">
              <HugeiconsIcon icon={Download01Icon} size={13} />
              Export CSV
            </Button>
          </>
        }
        meta={
          <Badge variant="success">
            <HugeiconsIcon icon={FingerPrintIcon} size={10} />
            SHA-256 chained · last hash {headHash.hash ? headHash.hash.slice(0, 4) + "…" + headHash.hash.slice(-4) : "—"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KindCard tone="info" label="System actions" value={system} />
        <KindCard tone="primary" label="Officer actions" value={officer} />
      </div>

      <Card className="mt-5 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold">Event log</h3>
          <span className="text-muted-foreground text-[11px]">
            Showing {events.length} of {auditPage.meta.total} · retained for 7 years
          </span>
        </div>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No audit events recorded yet.</p>
        ) : (
          <ol className="mt-4 space-y-0">
            {events.map((e, i) => (
              <li key={e.id} className="relative flex gap-3 py-3 pl-6">
                {i !== events.length - 1 && <span className="bg-border absolute top-7 bottom-0 left-2 w-px" />}
                <span className={`absolute top-3.5 left-1 grid size-2.5 place-items-center rounded-full ring-2 ring-background ${roleColor(e.actor_role)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug">
                    <span className="font-medium">{e.action}</span>{" "}
                    <span className="text-muted-foreground">— {e.target_type}</span>
                  </p>
                  {e.detail && (
                    <p className="text-muted-foreground mt-0.5 text-[11px]">{JSON.stringify(e.detail)}</p>
                  )}
                  <p className="text-muted-foreground mt-0.5 font-mono text-[10.5px]">
                    {formatDateTime(e.timestamp)} · {e.actor_label}{" "}
                    <span className="bg-muted text-foreground/70 ml-1 rounded px-1 text-[9.5px]">{e.actor_role.toUpperCase()}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  )
}

function KindCard({ tone, label, value }: { tone: string; label: string; value: number }) {
  const colors: Record<string, string> = {
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
    saffron: "bg-amber-50 text-amber-700",
  }
  return (
    <div className={`rounded-xl p-4 ${colors[tone] ?? ""}`}>
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-2 font-mono text-2xl font-bold">{value}</div>
    </div>
  )
}

function roleColor(role: string) {
  return role === "system" ? "bg-info" : role === "officer" ? "bg-primary" : "bg-saffron"
}

function formatDateTime(iso: string) {
  return fmtDateTime(iso)
}

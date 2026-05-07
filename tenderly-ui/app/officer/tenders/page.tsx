import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Calendar03Icon,
  Building01Icon,
  AiBrain01Icon,
  Clock01Icon,
  Award01Icon,
  Note02Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/portal/header"
import { NewTenderModal } from "@/components/portal/new-tender-modal"
import { DeleteTenderButton } from "@/components/portal/delete-tender-button"
import { listTenders } from "@/lib/api/tenders"
import { fmtDate } from "@/lib/utils"

export default async function TendersList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusFilter = "" } = await searchParams
  const tenders = await listTenders().catch(() => [])

  const byStatus = {
    all: tenders.length,
    active: tenders.filter((t) => t.status === "active").length,
    evaluation: tenders.filter((t) => t.status === "evaluation").length,
    completed: tenders.filter((t) => t.status === "completed").length,
  }

  const filtered = statusFilter
    ? tenders.filter((t) => t.status === statusFilter)
    : tenders

  const chips = [
    { label: "All", status: "", count: byStatus.all },
    { label: "Open", status: "active", count: byStatus.active },
    { label: "Under Evaluation", status: "evaluation", count: byStatus.evaluation },
    { label: "Completed", status: "completed", count: byStatus.completed },
  ]

  return (
    <>
      <PageHeader
        title="Tenders"
        description="All procurement tenders within your wing."
        actions={<NewTenderModal />}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = statusFilter === chip.status
          return (
            <Link
              key={chip.status}
              href={chip.status ? `/officer/tenders?status=${chip.status}` : "/officer/tenders"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {chip.label}
              <span className="bg-muted text-foreground/70 rounded-full px-1.5 text-[10px] font-mono tabular-nums">{chip.count}</span>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No tenders found. Create your first tender to get started.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="flex items-center gap-2 pr-3 hover:bg-muted/30">
                <Link href={`/officer/tenders/${t.id}`}
                  className="grid min-w-0 flex-1 grid-cols-1 gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(t.status)}>
                        <HugeiconsIcon icon={t.status === "active" ? Clock01Icon : t.status === "evaluation" ? AiBrain01Icon : Award01Icon} size={10} />
                        {statusLabel(t.status)}
                      </Badge>
                      {t.category && <Badge variant="muted">{t.category}</Badge>}
                      <span className="text-muted-foreground font-mono text-[11px]">{t.tender_number}</span>
                    </div>
                    <h3 className="font-heading mt-2 text-base font-semibold leading-snug">{t.title}</h3>
                    <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      {t.issuing_authority && (
                        <span className="inline-flex items-center gap-1">
                          <HugeiconsIcon icon={Building01Icon} size={11} /> {t.issuing_authority}
                        </span>
                      )}
                      {t.submission_deadline && (
                        <span className="inline-flex items-center gap-1">
                          <HugeiconsIcon icon={Calendar03Icon} size={11} /> Deadline {fmtDate(t.submission_deadline)}
                        </span>
                      )}
                      {t.estimated_value && (
                        <span className="inline-flex items-center gap-1">
                          <HugeiconsIcon icon={Note02Icon} size={11} /> {t.estimated_value}
                        </span>
                      )}
                    </div>
                  </div>
                  <HugeiconsIcon icon={ArrowRight02Icon} size={16} className="text-muted-foreground" />
                </Link>
                <DeleteTenderButton
                  tenderId={t.id}
                  tenderTitle={t.title}
                  tenderStatus={t.status}
                  variant="icon"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function statusLabel(s: string) {
  const m: Record<string, string> = { draft: "Draft", active: "Open", evaluation: "Evaluating", completed: "Completed" }
  return m[s] ?? s
}

function statusVariant(s: string): "success" | "info" | "muted" | "saffron" {
  if (s === "active") return "info"
  if (s === "evaluation") return "saffron"
  if (s === "completed") return "success"
  return "muted"
}


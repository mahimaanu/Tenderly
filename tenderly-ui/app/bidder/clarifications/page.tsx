import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Mail01Icon,
  CheckmarkCircle02Icon,
  Building01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/portal/header"
import { getClarifications } from "@/lib/api/bidder-api"
import { fmtDateTime } from "@/lib/utils"

export default async function Clarifications() {
  const clarifications = await getClarifications().catch(() => [])

  const open = clarifications.filter((c) => c.status === "open")

  return (
    <>
      <PageHeader
        title="Clarifications"
        description="Messages and requests from the procurement officer regarding your submissions."
        meta={
          open.length > 0 ? (
            <Badge variant="warning">
              <HugeiconsIcon icon={AlertCircleIcon} size={10} />
              {open.length} open
            </Badge>
          ) : (
            <Badge variant="success">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={10} />
              All resolved
            </Badge>
          )
        }
      />

      {clarifications.length === 0 ? (
        <Card className="p-8 text-center">
          <HugeiconsIcon icon={Mail01Icon} size={24} className="text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No messages from the officer yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {clarifications.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 p-5 pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant={c.status === "open" ? "warning" : "muted"}>
                      {c.status === "open" ? (
                        <><HugeiconsIcon icon={AlertCircleIcon} size={10} /> Open</>
                      ) : (
                        <><HugeiconsIcon icon={CheckmarkCircle02Icon} size={10} /> {c.status}</>
                      )}
                    </Badge>
                    {c.tender_number && (
                      <span className="text-[11px] text-muted-foreground font-mono">{c.tender_number}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold">{c.subject}</h3>
                  {c.tender_title && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <HugeiconsIcon icon={Building01Icon} size={10} />
                      {c.tender_title}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                  {fmtDateTime(c.created_at)}
                </span>
              </div>

              {/* Message thread */}
              <div className="border-t border-border/60 px-5 py-4 space-y-3">
                {c.messages && c.messages.length > 0 ? (
                  c.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg px-4 py-3 text-sm ${
                        msg.author_role === "officer"
                          ? "bg-primary/5 border border-primary/15"
                          : "bg-muted/60 border border-border/60 ml-6"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        {msg.author_role === "officer" ? "Officer" : "You"} · {fmtDateTime(msg.created_at)}
                      </p>
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  ))
                ) : c.body ? (
                  <div className="rounded-lg px-4 py-3 text-sm bg-primary/5 border border-primary/15">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Officer
                    </p>
                    <p className="leading-relaxed">{c.body}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Clock01Icon,
  HashtagIcon,
  ReceiptIndianRupeeIcon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { listSubmissions } from "@/lib/api/bidder-api"
import { fmtDate, fmtDateTime } from "@/lib/utils"

export default async function MySubmissions() {
  const submissions = await listSubmissions().catch(() => [])

  return (
    <>
      <PageHeader title="My Submissions" description="All your bid submissions across all tenders." />

      {submissions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No submissions yet.</p>
          <Button asChild size="sm"><Link href="/bidder/tenders">Browse open tenders</Link></Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {submissions.map((s) => (
            <Card key={s.id}>
              <Link href={`/bidder/submissions/${s.id}`} className="flex items-start gap-4 p-5 hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge>
                    {s.tender_number && (
                      <span className="font-mono text-[11px] text-muted-foreground">{s.tender_number}</span>
                    )}
                  </div>

                  <p className="text-sm font-semibold leading-snug">
                    {s.tender_title ?? s.title ?? s.tender_id}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <HugeiconsIcon icon={Clock01Icon} size={11} />
                      {s.submitted_at
                        ? `Submitted ${fmtDateTime(s.submitted_at)}`
                        : s.signed_at
                        ? `Signed ${fmtDateTime(s.signed_at)}`
                        : s.created_at
                        ? `Created ${fmtDateTime(s.created_at)}`
                        : "Draft"}
                    </span>

                    {(s as unknown as Record<string, unknown>).closing_on && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={Calendar03Icon} size={11} />
                        Deadline {fmtDate(String((s as unknown as Record<string, unknown>).closing_on))}
                      </span>
                    )}

                    {s.bid_amount != null && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={ReceiptIndianRupeeIcon} size={11} />
                        Bid: ₹{Number(s.bid_amount).toLocaleString()}
                      </span>
                    )}

                    {s.emd_reference && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={HashtagIcon} size={11} />
                        EMD: {s.emd_reference}
                      </span>
                    )}

                    {s.estimated_value != null && s.bid_amount == null && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={ReceiptIndianRupeeIcon} size={11} />
                        Est: ₹{Number(s.estimated_value).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <Button variant="outline" size="sm" className="shrink-0 mt-0.5">
                  Track <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    signed: "Signed",
    submitted: "Submitted",
    withdrawn: "Withdrawn",
  }
  return map[s] ?? s
}

function statusVariant(s: string): "success" | "info" | "muted" | "saffron" {
  if (s === "submitted") return "info"
  if (s === "signed") return "saffron"
  if (s === "withdrawn") return "muted"
  return "muted"
}

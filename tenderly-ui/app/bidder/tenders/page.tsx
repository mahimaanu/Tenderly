import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Calendar03Icon,
  Clock01Icon,
  Note02Icon,
  Building01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { getBidderTenders } from "@/lib/api/bidder-api"
import { fmtDate } from "@/lib/utils"

export default async function BidderTenders() {
  const tenders = await getBidderTenders().catch(() => []) as Record<string, unknown>[]

  return (
    <>
      <PageHeader
        title="Browse Tenders"
        description="Open procurement tenders you can bid on."
      />

      {tenders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No open tenders available right now. Check back soon.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tenders.map((t, i) => (
            <Card key={String(t.id ?? i)} className="overflow-hidden">
              <Link href={`/bidder/tenders/${t.id}`}
                className="grid grid-cols-1 gap-4 p-5 hover:bg-muted/30 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="info">
                      <HugeiconsIcon icon={Clock01Icon} size={10} /> Open
                    </Badge>
                    {t.category && <Badge variant="muted">{String(t.category)}</Badge>}
                    <span className="text-muted-foreground font-mono text-[11px]">{String(t.tender_number ?? "")}</span>
                  </div>
                  <h3 className="font-heading text-base font-semibold leading-snug">{String(t.title ?? "")}</h3>
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    {t.issuing_authority && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={Building01Icon} size={11} /> {String(t.issuing_authority)}
                      </span>
                    )}
                    {(t.closing_on ?? t.submission_deadline) && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={Calendar03Icon} size={11} />
                        Deadline {fmtDate(String(t.closing_on ?? t.submission_deadline ?? ""))}
                      </span>
                    )}
                    {t.estimated_value && (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={Note02Icon} size={11} /> {String(t.estimated_value)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm">
                    View & Submit <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
                  </Button>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}


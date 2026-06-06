import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Building01Icon,
  Mail01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/portal/header"
import { VerdictBadge } from "@/components/portal/verdict"
import { sampleTender } from "@/lib/mock-data"

export default function BidderDirectory() {
  const bidders = sampleTender.bidders

  return (
    <>
      <PageHeader
        title="Bidder Directory"
        description="All vendors registered across all tenders."
        meta={<Badge variant="muted"><HugeiconsIcon icon={UserMultiple02Icon} size={10} />{bidders.length} total</Badge>}
      />

      <div className="mb-4">
        <Input placeholder="Search by company name, registration number…" className="max-w-md" />
      </div>

      {bidders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No bidders found. Bidders appear here once they register for a tender.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bidders.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className="text-muted-foreground text-[11px] font-mono mt-0.5">{b.registrationNo}</p>
                </div>
                <VerdictBadge verdict={b.overall} size="sm" className="shrink-0" />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <HugeiconsIcon icon={Building01Icon} size={11} /> {b.city}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <HugeiconsIcon icon={Mail01Icon} size={11} /> {b.email}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Score: <span className="font-medium text-foreground">{b.score}%</span></span>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/officer/tenders/${sampleTender.id}/bidders/${b.id}`}>
                    View <HugeiconsIcon icon={ArrowRight02Icon} size={11} />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

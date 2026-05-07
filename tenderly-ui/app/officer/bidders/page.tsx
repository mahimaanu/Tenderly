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
import { listAllBidders } from "@/lib/api/bidders"

export default async function BidderDirectory() {
  const bidders = await listAllBidders().catch(() => [])

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
                  <p className="text-sm font-semibold truncate">{b.company_name}</p>
                  <p className="text-muted-foreground text-[11px] font-mono mt-0.5">{b.registration_number ?? "—"}</p>
                </div>
                <Badge variant="muted" className="shrink-0 text-[10px]">{b.status}</Badge>
              </div>
              <div className="mt-3 space-y-1.5">
                {b.city && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <HugeiconsIcon icon={Building01Icon} size={11} /> {b.city}
                  </div>
                )}
                {b.contact_email && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <HugeiconsIcon icon={Mail01Icon} size={11} /> {b.contact_email}
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/officer/tenders/${b.tender_id}/bidders/${b.id}`}>
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

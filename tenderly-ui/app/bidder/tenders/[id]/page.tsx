import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  Calendar03Icon,
  Note02Icon,
  Building01Icon,
  Download01Icon,
  Attachment01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { getBidderTenderDetail } from "@/lib/api/bidder-api"
import { fmtDate } from "@/lib/utils"

export default async function BidderTenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tender = await getBidderTenderDetail(id).catch(() => null)

  if (!tender) notFound()

  const criteria = (tender.criteria ?? []) as Record<string, unknown>[]
  const documents = (tender.documents ?? []) as Record<string, unknown>[]

  return (
    <>
      <PageHeader
        title={String(tender.title ?? "")}
        description={`${String(tender.tender_number ?? "")} · ${String(tender.issuing_authority ?? "")}`}
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href="/bidder/tenders">
                <HugeiconsIcon icon={ArrowLeft02Icon} size={13} /> Back
              </Link>
            </Button>
            <Button size="lg" asChild>
              <Link href={`/bidder/tenders/${id}/submit`}>Submit Bid</Link>
            </Button>
          </>
        }
        meta={
          <>
            <Badge variant="info">Open</Badge>
            {tender.submission_deadline && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <HugeiconsIcon icon={Calendar03Icon} size={12} />
                Deadline {fmtDate(String(tender.submission_deadline))}
              </span>
            )}
            {tender.estimated_value && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <HugeiconsIcon icon={Note02Icon} size={12} />
                {String(tender.estimated_value)}
              </span>
            )}
          </>
        }
      />

      <Card className="mb-4 p-5">
        <h3 className="font-heading text-sm font-semibold mb-3">Tender Details</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {tender.issuing_authority && <Detail label="Issuing Authority" value={String(tender.issuing_authority)} />}
          {tender.category && <Detail label="Category" value={String(tender.category)} />}
          {tender.estimated_value && <Detail label="Estimated Value" value={String(tender.estimated_value)} />}
          {tender.submission_deadline && <Detail label="Deadline" value={fmtDate(String(tender.submission_deadline))} />}
          {tender.description && <Detail label="Description" value={String(tender.description)} className="sm:col-span-2" />}
        </div>
      </Card>

      {criteria.length > 0 && (
        <Card className="mb-4">
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Eligibility Criteria</h3>
            <p className="text-muted-foreground text-[11px]">{criteria.length} criteria to satisfy</p>
          </div>
          <ul className="divide-y divide-border/60">
            {criteria.map((c, i) => (
              <li key={String(c.id ?? i)} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {c.criterion_code && <Badge variant="muted" className="text-[10px]">{String(c.criterion_code)}</Badge>}
                      <Badge variant={String(c.priority) === "mandatory" ? "danger" : "muted"} className="text-[10px]">
                        {String(c.priority ?? "optional")}
                      </Badge>
                    </div>
                    <p className="text-sm">{String(c.description ?? "")}</p>
                    {c.threshold_value && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        Threshold: {String(c.threshold_operator ?? "")} {String(c.threshold_value)} {String(c.unit ?? "")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {documents.length > 0 && (
        <Card>
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Tender Documents</h3>
          </div>
          <ul className="divide-y divide-border/60">
            {documents.map((d, i) => (
              <li key={String(d.id ?? i)} className="flex items-center gap-3 px-5 py-3">
                <HugeiconsIcon icon={Attachment01Icon} size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{String(d.filename ?? "")}</p>
                </div>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon icon={Download01Icon} size={11} /> Download RFP
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function Detail({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10.5px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</div>
      <p className="text-sm">{value}</p>
    </div>
  )
}

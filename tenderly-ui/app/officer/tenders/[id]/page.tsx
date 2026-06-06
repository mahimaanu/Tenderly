import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Calendar03Icon,
  Building01Icon,
  Note02Icon,
  AiBrain01Icon,
  Download01Icon,
  UserMultiple02Icon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { VerdictBadge, VerdictDot } from "@/components/portal/verdict"
import { LockCriteriaButton, UploadDocumentButton, ReExtractButton } from "@/components/portal/tender-actions"
import { AddCriterionModal } from "@/components/portal/add-criterion-modal"
import { getTender, getCriteria, getTenderDocuments } from "@/lib/api/tenders"
import { listBidders } from "@/lib/api/bidders"
import { DeleteTenderButton } from "@/components/portal/delete-tender-button"
import { fmtDate } from "@/lib/utils"

export default async function TenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [tender, criteria, bidders, documents] = await Promise.all([
    getTender(id).catch(() => null),
    getCriteria(id).catch(() => []),
    listBidders(id).catch(() => []),
    getTenderDocuments(id).catch(() => []),
  ])

  if (!tender) notFound()

  const verdict = (b: typeof bidders[0]) => b.final_verdict ?? b.overall_verdict ?? ""
  const eligible = bidders.filter((b) => verdict(b) === "eligible").length
  const ineligible = bidders.filter((b) => verdict(b) === "not_eligible" || verdict(b) === "ineligible").length
  const review = bidders.filter((b) => verdict(b) === "needs_review").length
  const criteriaLocked = tender.status !== "draft"

  return (
    <>
      <PageHeader
        title={tender.title}
        description={`${tender.tender_number} · ${tender.issuing_authority ?? ""}`}
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href="/officer/tenders">
                <HugeiconsIcon icon={ArrowLeft02Icon} size={13} /> Back
              </Link>
            </Button>
            <DeleteTenderButton
              tenderId={id}
              tenderTitle={tender.title}
              tenderStatus={tender.status}
              redirectTo="/officer/tenders"
              variant="full"
            />
            <Button size="lg">
              <HugeiconsIcon icon={Download01Icon} size={13} /> Export Report
            </Button>
          </>
        }
        meta={
          <>
            <Badge variant={statusVariant(tender.status)}>
              <HugeiconsIcon icon={AiBrain01Icon} size={10} />
              {statusLabel(tender.status)}
            </Badge>
            {tender.submission_deadline && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <HugeiconsIcon icon={Calendar03Icon} size={12} />
                Deadline {fmtDate(tender.submission_deadline)}
              </span>
            )}
            {tender.estimated_value && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <HugeiconsIcon icon={Note02Icon} size={12} />
                {tender.estimated_value}
              </span>
            )}
          </>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
        <StatBox label="Bidders" value={bidders.length} color="text-foreground" />
        <StatBox label="Eligible" value={eligible} color="text-success" />
        <StatBox label="Manual Review" value={review} color="text-warning-foreground" />
        <StatBox label="Ineligible" value={ineligible} color="text-danger" />
      </div>

      {/* Upload Document */}
      <Card className="mb-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-sm font-semibold">Tender Documents</h3>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              {documents.length > 0
                ? `${documents.length} document(s) uploaded · criteria extracted automatically`
                : "Upload the RFP PDF or DOCX to auto-extract eligibility criteria"}
            </p>
          </div>
          <UploadDocumentButton tenderId={id} />
        </div>

        {documents.length > 0 && (
          <ul className="mt-4 divide-y divide-border/60 border-t border-border/60">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 pt-3 pb-1">
                <HugeiconsIcon icon={Attachment01Icon} size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.filename}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {d.page_count ? `${d.page_count} pages · ` : ""}{d.processed ? "Processed" : "Processing…"}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon icon={Download01Icon} size={11} /> Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Criteria */}
      <Card className="mb-4">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="font-heading text-sm font-semibold">Eligibility Criteria</h3>
            <p className="text-muted-foreground text-[11px]">
              {criteria.length > 0 ? `${criteria.length} criteria extracted` : "No criteria yet — upload an RFP to extract"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {documents.length > 0 && !criteriaLocked && (
              <ReExtractButton tenderId={id} />
            )}
            {!criteriaLocked && (
              <AddCriterionModal tenderId={id} />
            )}
            {!criteriaLocked && criteria.length > 0 && (
              <LockCriteriaButton tenderId={id} />
            )}
            {criteriaLocked && (
              <Badge variant="success" className="text-[11px]">Criteria locked</Badge>
            )}
          </div>
        </div>

        {criteria.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            No criteria yet. Upload an RFP document to extract criteria automatically, or add them manually using &ldquo;Add Criterion&rdquo; above.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {criteria.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="muted" className="text-[10px]">{c.criterion_code ?? c.type}</Badge>
                      <Badge variant={c.priority === "mandatory" ? "danger" : "muted"} className="text-[10px]">{c.priority}</Badge>
                      {c.manually_verified && <Badge variant="success" className="text-[10px]">Verified</Badge>}
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-snug">{c.description}</p>
                    {c.threshold_value && (
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        Threshold: {c.threshold_operator} {c.threshold_value} {c.unit}
                      </p>
                    )}
                    {c.confidence != null && (
                      <p className="text-muted-foreground mt-0.5 text-[11px] font-mono">
                        Confidence: {Math.round(c.confidence * 100)}%
                        {c.source_page ? ` · Page ${c.source_page}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Bidders */}
      <Card className="mb-4">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="font-heading text-sm font-semibold">Bidders</h3>
            <p className="text-muted-foreground text-[11px]">{bidders.length} registered</p>
          </div>
          <Button size="sm">
            <HugeiconsIcon icon={UserMultiple02Icon} size={12} /> Add Bidder
          </Button>
        </div>
        {bidders.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No bidders registered yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {bidders.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/officer/tenders/${id}/bidders/${b.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40"
                >
                  {mapVerdict(b) ? (
                    <VerdictDot verdict={mapVerdict(b)!} />
                  ) : (
                    <span className="inline-block size-2 rounded-full bg-muted-foreground/30" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{b.company_name}</span>
                      {b.city && <span className="text-muted-foreground text-[11px]">· {b.city}</span>}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-[11px] font-mono">
                      {b.registration_number ?? ""}
                      {b.contact_email ? ` · ${b.contact_email}` : ""}
                    </div>
                  </div>
                  {mapVerdict(b) ? (
                    <VerdictBadge verdict={mapVerdict(b)!} />
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
    </>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">{label}</div>
      <div className={`font-mono text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  )
}

function mapVerdict(b: { overall_verdict?: string; final_verdict?: string }): "eligible" | "ineligible" | "manual_review" | null {
  const v = b.final_verdict ?? b.overall_verdict ?? ""
  if (v === "eligible") return "eligible"
  if (v === "not_eligible" || v === "ineligible") return "ineligible"
  if (v === "needs_review") return "manual_review"
  return null
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


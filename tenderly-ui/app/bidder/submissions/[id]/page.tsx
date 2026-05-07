import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  CheckmarkCircle02Icon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { getSubmission } from "@/lib/api/bidder-api"
import { fmtDate, fmtDateTime } from "@/lib/utils"

export default async function SubmissionTracking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const submission = await getSubmission(id).catch(() => null)

  if (!submission) notFound()

  const documents = submission.documents
  const evalRows = submission.preliminary_evaluation
  const timeline = submission.timeline

  const tenderTitle = String(submission.tender_title ?? submission.title ?? "Untitled Tender")
  const tenderNumber = String(submission.tender_number ?? submission.tender_id ?? "")

  return (
    <>
      <PageHeader
        title={tenderTitle}
        description={`Submission · ${tenderNumber}`}
        actions={
          <Button variant="outline" size="lg" asChild>
            <Link href="/bidder/submissions">
              <HugeiconsIcon icon={ArrowLeft02Icon} size={13} /> All submissions
            </Link>
          </Button>
        }
        meta={
          <Badge variant={statusVariant(submission.status)}>
            {statusLabel(submission.status)}
          </Badge>
        }
      />

      {/* Timeline */}
      {timeline.length > 0 && (
        <Card className="mb-4 p-5">
          <h3 className="font-heading text-sm font-semibold mb-4">Progress</h3>
          <ol className="flex items-start gap-0">
            {timeline.map((step, i) => (
              <li key={step.key} className="flex flex-1 flex-col items-center gap-1 relative">
                {i < timeline.length - 1 && (
                  <span
                    className={`absolute top-3 left-1/2 h-0.5 w-full ${step.done ? "bg-primary" : "bg-border"}`}
                    style={{ zIndex: 0 }}
                  />
                )}
                <span
                  className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ring-2 ring-background text-[10px] font-bold
                    ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {step.done ? <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} /> : i + 1}
                </span>
                <span className={`text-center text-[10.5px] leading-tight ${step.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                  {step.at && <span className="block text-[10px] text-muted-foreground font-normal">{fmtDate(step.at)}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Submission details */}
      <Card className="mb-4 p-5">
        <h3 className="font-heading text-sm font-semibold mb-3">Submission Details</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 text-sm">
          <Detail label="Status" value={statusLabel(submission.status)} />
          <Detail label="Created" value={fmtDateTime(submission.created_at)} />
          {submission.submitted_at && <Detail label="Submitted On" value={fmtDateTime(submission.submitted_at)} />}
          {submission.signed_at && <Detail label="Signed On" value={fmtDateTime(submission.signed_at)} />}
          {submission.closing_on && <Detail label="Tender Deadline" value={fmtDate(submission.closing_on)} accent />}
          {submission.estimated_value != null && (
            <Detail label="Estimated Value" value={`₹${Number(submission.estimated_value).toLocaleString()}`} />
          )}
          {submission.bid_amount != null && (
            <Detail label="Your Bid Amount" value={`₹${Number(submission.bid_amount).toLocaleString()}`} />
          )}
          {submission.emd_reference && <Detail label="EMD Reference" value={submission.emd_reference} />}
        </div>
        {submission.notes && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-[10.5px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{submission.notes}</p>
          </div>
        )}
      </Card>

      {/* Uploaded documents */}
      {documents.length > 0 && (
        <Card className="mb-4">
          <div className="p-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-heading text-sm font-semibold">Uploaded Documents</h3>
              <p className="text-muted-foreground text-[11px]">{documents.length} file{documents.length !== 1 ? "s" : ""} attached</p>
            </div>
          </div>
          <ul className="divide-y divide-border/60">
            {documents.map((d, i) => (
              <li key={String(d.id ?? i)} className="flex items-center gap-3 px-5 py-3">
                <HugeiconsIcon icon={Attachment01Icon} size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{String(d.filename ?? d.name ?? "")}</p>
                  <p className="text-muted-foreground text-[11px] font-mono">
                    {String(d.kind ?? d.document_type ?? "—")}
                    {d.format ? ` · ${String(d.format).toUpperCase()}` : ""}
                    {d.page_count ? ` · ${String(d.page_count)}p` : ""}
                    {d.confidence_score != null ? ` · OCR ${Math.round(Number(d.confidence_score) * 100)}%` : ""}
                  </p>
                </div>
                <Badge variant={d.processed ? "success" : "muted"} className="text-[10px] shrink-0">
                  {d.processed ? "Processed" : "Processing…"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Per-criterion preliminary results — criteria descriptions only */}
      {evalRows.length > 0 && (
        <Card className="mb-4">
          <div className="p-5 pb-3">
            <h3 className="font-heading text-sm font-semibold">Preliminary Eligibility Check</h3>
            <p className="text-muted-foreground text-[11px]">{evalRows.length} criteria to satisfy</p>
          </div>
          <ul className="divide-y divide-border/60">
            {evalRows.map((ce, i) => (
              <li key={String(ce.id ?? i)} className="flex items-start gap-3 px-5 py-3">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm">{String(ce.criterion_description ?? ce.requirement ?? "")}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Empty state when no documents uploaded yet */}
      {documents.length === 0 && evalRows.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <HugeiconsIcon icon={Attachment01Icon} size={24} className="mx-auto mb-2 opacity-30" />
          <p>No documents uploaded yet.</p>
          <p className="text-[11px] mt-1">Upload your bid documents to complete this submission.</p>
        </Card>
      )}
    </>
  )
}

function Detail({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{label}</div>
      <p className={`text-sm font-medium ${accent ? "text-warning-foreground" : ""}`}>{value || "—"}</p>
    </div>
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


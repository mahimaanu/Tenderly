"use client"
import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  CloudUploadIcon,
  CheckmarkCircle02Icon,
  FingerPrintIcon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { createSubmission, uploadSubmissionDocuments, signSubmission, submitBid } from "@/lib/api/bidder-api"

export default function SubmitBidPage({ params }: { params: Promise<{ id: string }> }) {
  const [tenderId, setTenderId] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<{ id: string; name: string; format?: string; ocr_confidence?: number }[]>([])
  const [bidAmount, setBidAmount] = useState("")
  const [emdRef, setEmdRef] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"upload" | "sign" | "done">("upload")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Resolve params (Next 15 async params in client component workaround)
  if (!tenderId) {
    params.then(({ id }) => setTenderId(id))
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>
  }

  async function handleFileDrop(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setError(null)
    startTransition(async () => {
      try {
        let sid = submissionId
        if (!sid) {
          const sub = await createSubmission(tenderId!)
          sid = sub.id
          setSubmissionId(sid)
        }
        const res = await uploadSubmissionDocuments(sid, files)
        setUploadedDocs((prev) => [...prev, ...res.documents])
      } catch (err: unknown) {
        setError((err as Error).message ?? "Upload failed")
      }
    })
  }

  async function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        let sid = submissionId
        if (!sid) {
          const sub = await createSubmission(tenderId!)
          sid = sub.id
          setSubmissionId(sid)
        }
        setStep("sign")
        await signSubmission(sid)
        await submitBid(sid)
        setStep("done")
        router.push(`/bidder/submissions/${sid}`)
      } catch (err: unknown) {
        setError((err as Error).message ?? "Submission failed")
        setStep("upload")
      }
    })
  }

  if (step === "done") {
    return (
      <div className="p-8 text-center">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={32} className="text-success mx-auto mb-3" />
        <p className="text-lg font-semibold">Bid submitted successfully!</p>
        <Button asChild className="mt-4"><Link href="/bidder/submissions">Track submission</Link></Button>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Submit Bid"
        description="Upload your supporting documents and sign your bid digitally."
        actions={
          <Button variant="outline" size="lg" asChild>
            <Link href={`/bidder/tenders/${tenderId}`}>
              <HugeiconsIcon icon={ArrowLeft02Icon} size={13} /> Back
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Document upload */}
      <Card className="mb-4 p-5">
        <h3 className="font-heading text-sm font-semibold mb-3">1. Upload Documents</h3>
        <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
          <HugeiconsIcon icon={CloudUploadIcon} size={32} className="text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-[11px] text-muted-foreground mt-1">PDF, DOCX, JPG, PNG · Max 25 MB per file</p>
          </div>
          <input type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png" className="hidden" onChange={handleFileDrop} disabled={pending} />
        </label>

        {uploadedDocs.length > 0 && (
          <ul className="mt-4 divide-y divide-border/60">
            {uploadedDocs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <HugeiconsIcon icon={Attachment01Icon} size={15} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {d.format ?? ""}
                    {d.ocr_confidence != null ? ` · OCR ${Math.round(d.ocr_confidence * 100)}%` : " · Processing…"}
                  </p>
                </div>
                <Badge variant="success"><HugeiconsIcon icon={CheckmarkCircle02Icon} size={10} /> Uploaded</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Bid details */}
      <Card className="mb-4 p-5">
        <h3 className="font-heading text-sm font-semibold mb-3">2. Bid Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Bid Amount (₹)</label>
            <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">EMD Reference</label>
            <input type="text" value={emdRef} onChange={(e) => setEmdRef(e.target.value)} placeholder="DD/Pay Order number"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Additional Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional information for the evaluation officer…"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
        </div>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {step === "sign" ? "Signing with mock DSC…" : `${uploadedDocs.length} document(s) uploaded`}
        </p>
        <Button onClick={handleSubmit} disabled={pending || uploadedDocs.length === 0} size="lg">
          <HugeiconsIcon icon={FingerPrintIcon} size={14} />
          {pending ? (step === "sign" ? "Signing…" : "Submitting…") : "Sign with DSC & Submit"}
        </Button>
      </div>
    </>
  )
}

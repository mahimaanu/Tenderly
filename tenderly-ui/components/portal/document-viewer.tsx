"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  EyeIcon,
  Attachment01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { BidderDocument } from "@/lib/types"

const kindLabels: Record<BidderDocument["kind"], string> = {
  audited_balance_sheet: "Audited Balance Sheet",
  ca_certificate: "CA Certificate",
  experience_certificate: "Experience Certificate",
  work_order: "Work Order",
  completion_certificate: "Completion Certificate",
  gst_certificate: "GST Registration",
  iso_certificate: "ISO Certificate",
  pan: "PAN Card",
  msme: "MSME Certificate",
  bid_form: "Bid Form",
  epf_registration: "EPF Registration",
}

export function DocumentViewerButton({ doc }: { doc: BidderDocument }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={EyeIcon} size={11} /> View
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-background border border-border shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="muted" className="text-[10px] shrink-0">{kindLabels[doc.kind] ?? doc.kind}</Badge>
                  <Badge variant="muted" className="text-[10px] shrink-0">{doc.format}</Badge>
                  {doc.ocrConfidence != null && (
                    <Badge
                      variant={doc.ocrConfidence >= 0.85 ? "success" : doc.ocrConfidence >= 0.6 ? "warning" : "danger"}
                      className="text-[10px] shrink-0"
                    >
                      OCR {Math.round(doc.ocrConfidence * 100)}%
                    </Badge>
                  )}
                </div>
                <h2 className="text-sm font-semibold truncate">{doc.name}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {doc.pages} {doc.pages === 1 ? "page" : "pages"} · Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
              </button>
            </div>

            {/* Document preview area */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-xl border border-border bg-muted/30 flex flex-col items-center justify-center gap-3 py-16">
                <div className="rounded-full bg-muted p-4">
                  <HugeiconsIcon icon={Attachment01Icon} size={28} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {doc.format} · {doc.pages} {doc.pages === 1 ? "page" : "pages"}
                  </p>
                  {doc.ocrConfidence != null && doc.ocrConfidence < 0.6 && (
                    <p className="text-[11px] text-warning-foreground mt-2 max-w-xs">
                      Low OCR confidence ({Math.round(doc.ocrConfidence * 100)}%) — document may be a low-resolution scan or photograph.
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground italic">Document preview not available in demo mode</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

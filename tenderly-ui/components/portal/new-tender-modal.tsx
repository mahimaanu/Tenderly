"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1"

function getToken() {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)tenderly_token=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

const CATEGORIES = [
  "Security & Defence Equipment",
  "Construction & Infrastructure",
  "Information Technology",
  "Medical Supplies",
  "Vehicles & Transport",
  "Uniforms & Clothing",
  "Food & Rations",
  "Communication Equipment",
  "Other",
]

export function NewTenderModal() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function close() {
    setOpen(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const body = {
      title: fd.get("title"),
      tender_number: fd.get("tender_number"),
      category: fd.get("category"),
      description: fd.get("description"),
      issuing_authority: fd.get("issuing_authority"),
      submission_deadline: fd.get("submission_deadline") || undefined,
      estimated_value: fd.get("estimated_value") || undefined,
      emd_amount: fd.get("emd_amount") ? Number(fd.get("emd_amount")) : undefined,
    }

    startTransition(async () => {
      try {
        const token = getToken()
        const res = await fetch(`${BASE}/tenders/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error?.message ?? `Error ${res.status}`)
        }
        const tender = await res.json()
        close()
        router.refresh()
        router.push(`/officer/tenders/${tender.id}`)
      } catch (err: unknown) {
        setError((err as Error).message ?? "Failed to create tender")
      }
    })
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={PlusSignIcon} size={13} />
        New Tender
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-background border border-border shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold">New Tender</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Create a tender — upload the RFP after creation to extract criteria automatically.
                </p>
              </div>
              <button
                onClick={close}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Tender Title *</Label>
                  <Input
                    name="title"
                    required
                    placeholder="e.g. Supply of Body Armour & Protective Gear"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Tender Number *</Label>
                  <Input
                    name="tender_number"
                    required
                    placeholder="ORG/PROC/2025-26/002"
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Category</Label>
                  <select
                    name="category"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select category…</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Issuing Authority</Label>
                  <Input
                    name="issuing_authority"
                    placeholder="Director General – Procurement Wing"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Submission Deadline</Label>
                  <Input name="submission_deadline" type="datetime-local" className="mt-1 text-sm" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Estimated Value</Label>
                  <Input name="estimated_value" placeholder="₹48,50,00,000" className="mt-1" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">EMD Amount (₹)</Label>
                  <Input name="emd_amount" type="number" placeholder="4850000" className="mt-1 font-mono" />
                </div>

                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Description</Label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Brief description of the procurement requirement…"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Creating…" : "Create Tender"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

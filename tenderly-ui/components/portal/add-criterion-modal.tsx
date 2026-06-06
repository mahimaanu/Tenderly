"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api/client"
import type { Criterion } from "@/lib/api/tenders"

const CRITERION_TYPES = [
  { value: "financial", label: "Financial" },
  { value: "technical", label: "Technical" },
  { value: "experience", label: "Experience" },
  { value: "certification", label: "Certification" },
  { value: "compliance", label: "Compliance" },
  { value: "documentation", label: "Documentation" },
]

const THRESHOLD_OPS = [">=", "<=", ">", "<", "="]

export function AddCriterionModal({ tenderId }: { tenderId: string }) {
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
      type: fd.get("type") as string,
      priority: fd.get("priority") as string,
      description: fd.get("description") as string,
      criterion_code: (fd.get("criterion_code") as string) || undefined,
      threshold_value: (fd.get("threshold_value") as string) || undefined,
      threshold_operator: (fd.get("threshold_operator") as string) || undefined,
      unit: (fd.get("unit") as string) || undefined,
    }

    startTransition(async () => {
      try {
        await apiFetch<Criterion>(`/tenders/${tenderId}/criteria`, {
          method: "POST",
          body: JSON.stringify(body),
        })
        close()
        router.refresh()
      } catch (err: unknown) {
        setError((err as Error).message ?? "Failed to add criterion")
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={PlusSignIcon} size={12} />
        Add Criterion
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-background border border-border shadow-xl">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold">Add Eligibility Criterion</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Manually add a criterion not extracted from the tender document.
                </p>
              </div>
              <button
                onClick={close}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Description *</Label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    placeholder="e.g. Bidder must have minimum annual turnover of ₹5 Crore in the last 3 financial years."
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Type *</Label>
                  <select
                    name="type"
                    required
                    defaultValue="financial"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CRITERION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Priority *</Label>
                  <select
                    name="priority"
                    required
                    defaultValue="mandatory"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="mandatory">Mandatory</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Criterion Code</Label>
                  <Input
                    name="criterion_code"
                    placeholder="e.g. FIN-03"
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div className="col-span-1" />

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Threshold Operator</Label>
                  <select
                    name="threshold_operator"
                    defaultValue=""
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">None</option>
                    {THRESHOLD_OPS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Threshold Value</Label>
                  <Input
                    name="threshold_value"
                    placeholder="e.g. 5 Crore"
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1">Unit</Label>
                  <Input
                    name="unit"
                    placeholder="e.g. INR Crore, years, km"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Adding…" : "Add Criterion"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

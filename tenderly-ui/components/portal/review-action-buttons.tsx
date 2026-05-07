"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Cancel01Icon, AiBrain01Icon, RefreshIcon, Mail01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api/client"

/** Runs AI evaluation for a single unevaluated bidder then navigates to the full criteria view. */
export function RunEvalButton({ bidderId, tenderId }: { bidderId: string; tenderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      await apiFetch(`/officer/bidders/${bidderId}/evaluate`, { method: "POST" })
      router.push(`/officer/tenders/${tenderId}/bidders/${bidderId}?from=review`)
    } catch (e: unknown) {
      setError((e as Error).message ?? "Evaluation failed")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" disabled={loading} onClick={run}>
        <HugeiconsIcon icon={loading ? RefreshIcon : AiBrain01Icon} size={11} />
        {loading ? "Evaluating…" : "Run Eval"}
      </Button>
      {error && <p className="text-[10px] text-danger max-w-[160px]">{error}</p>}
    </div>
  )
}

/** Eligible / Reject buttons for unevaluated bidders in the Manual Review queue. */
export function BidderVerdictButtons({ bidderId }: { bidderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<"eligible" | "not_eligible" | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(verdict: "eligible" | "not_eligible") {
    setLoading(verdict)
    setError(null)
    try {
      await apiFetch(`/officer/bidders/${bidderId}/verdict`, {
        method: "POST",
        body: JSON.stringify({ verdict }),
      })
      setDone(true)
      router.refresh()
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to set verdict")
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return <span className="text-xs text-muted-foreground italic">Verdict recorded</span>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          className="text-success border-success/30 hover:bg-success/5"
          onClick={() => submit("eligible")}
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={11} />
          {loading === "eligible" ? "Saving…" : "Eligible"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          className="text-danger border-danger/30 hover:bg-danger/5"
          onClick={() => submit("not_eligible")}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={11} />
          {loading === "not_eligible" ? "Saving…" : "Reject"}
        </Button>
      </div>
      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  )
}

export function ReviewActionButtons({
  criterionEvalId,
  onDone,
}: {
  criterionEvalId: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<"eligible" | "not_eligible" | null>(null)
  const [done, setDone] = useState(false)

  async function submit(verdict: "eligible" | "not_eligible") {
    setLoading(verdict)
    try {
      await apiFetch(`/tenders/criterion-evaluations/${criterionEvalId}/review`, {
        method: "POST",
        body: JSON.stringify({ verdict }),
      })
      setDone(true)
      onDone?.()
      router.refresh()
    } catch (e) {
      console.error("Review failed", e)
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return <span className="text-xs text-muted-foreground italic">Reviewed</span>
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        variant="outline"
        size="sm"
        disabled={loading !== null}
        className="text-success border-success/30 hover:bg-success/5"
        onClick={() => submit("eligible")}
      >
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={11} />
        {loading === "eligible" ? "Saving…" : "Eligible"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={loading !== null}
        className="text-danger border-danger/30 hover:bg-danger/5"
        onClick={() => submit("not_eligible")}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={11} />
        {loading === "not_eligible" ? "Saving…" : "Reject"}
      </Button>
    </div>
  )
}

/** Officer sends a direct message to a bidder — creates a clarification thread. */
export function NotifyBidderButton({ bidderId }: { bidderId: string }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("Message from Procurement Officer")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setSubject("Message from Procurement Officer")
    setBody("")
    setError(null)
    setSent(false)
    setOpen(true)
  }

  function close() {
    if (sending) return
    setOpen(false)
  }

  async function send() {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      await apiFetch(`/officer/bidders/${bidderId}/notify`, {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      })
      setSent(true)
      setTimeout(() => { setOpen(false); setSent(false) }, 1800)
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openModal}>
        <HugeiconsIcon icon={Mail01Icon} size={11} />
        Notify Bidder
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border border-border shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">Notify Bidder</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Message will appear in the bidder's Clarifications tab.
                </p>
              </div>
              <button
                onClick={close}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Subject
                </label>
                <Input
                  className="mt-1 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending || sent}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Message
                </label>
                <Textarea
                  className="mt-1 text-sm resize-none"
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={sending || sent}
                  placeholder="Type your message to the bidder…"
                />
              </div>
              {error && <p className="text-[11px] text-danger">{error}</p>}
              {sent && (
                <p className="text-[11px] text-success font-medium">
                  ✓ Message sent — visible in bidder's Clarifications tab.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 pb-5">
              <Button variant="outline" size="sm" onClick={close} disabled={sending}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={send}
                disabled={sending || sent || !body.trim()}
              >
                <HugeiconsIcon icon={Mail01Icon} size={11} />
                {sending ? "Sending…" : "Send Message"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, AlertCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { deleteTender } from "@/lib/api/tenders"

export function DeleteTenderButton({
  tenderId,
  tenderTitle,
  tenderStatus,
  redirectTo = "/officer/tenders",
  variant = "icon",
}: {
  tenderId: string
  tenderTitle: string
  tenderStatus: string
  redirectTo?: string
  variant?: "icon" | "full"
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const isActive = tenderStatus !== "draft"

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteTender(tenderId)
      router.push(redirectTo)
      router.refresh()
    } catch (e) {
      console.error("Delete failed", e)
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2">
        {isActive && (
          <HugeiconsIcon icon={AlertCircleIcon} size={13} className="text-danger shrink-0" />
        )}
        <span className="text-xs text-danger font-medium truncate max-w-[200px]">
          {isActive
            ? `"${tenderTitle}" has active data — delete anyway?`
            : `Delete "${tenderTitle}"?`}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          className="text-danger border-danger/40 hover:bg-danger/10 shrink-0 h-7 text-xs"
          onClick={handleDelete}
        >
          {loading ? "Deleting…" : "Yes, delete"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          className="shrink-0 h-7 text-xs"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    )
  }

  if (variant === "full") {
    return (
      <Button
        variant="outline"
        size="lg"
        className="text-danger border-danger/30 hover:bg-danger/5"
        onClick={() => setConfirming(true)}
      >
        <HugeiconsIcon icon={Delete02Icon} size={13} />
        Delete Tender
      </Button>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      title="Delete tender"
    >
      <HugeiconsIcon icon={Delete02Icon} size={14} />
    </button>
  )
}

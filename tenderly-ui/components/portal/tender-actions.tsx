"use client"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { LockIcon, CloudUploadIcon, CheckmarkCircle02Icon, AiBrain01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1"

function token() {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)tenderly_token=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function authFetch(path: string, init: RequestInit = {}) {
  const t = token()
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })
}

// ── Lock Criteria ─────────────────────────────────────────────────────────────

export function LockCriteriaButton({ tenderId, disabled }: { tenderId: string; disabled?: boolean }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleLock() {
    if (!confirm("Lock criteria? This will mark the tender as Active and criteria can no longer be changed.")) return
    setError(null)
    startTransition(async () => {
      const res = await authFetch(`/tenders/${tenderId}/criteria/confirm`, { method: "POST" })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setError(b?.error?.message ?? `Error ${res.status}`)
        return
      }
      setDone(true)
      router.refresh()
    })
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-success font-medium">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} /> Criteria locked
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleLock} disabled={pending || disabled}>
        <HugeiconsIcon icon={LockIcon} size={12} />
        {pending ? "Locking…" : "Lock Criteria"}
      </Button>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  )
}

// ── Re-extract Criteria ───────────────────────────────────────────────────────

export function ReExtractButton({ tenderId }: { tenderId: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [msg, setMsg] = useState<string | null>(null)

  async function handleExtract() {
    setState("running")
    setMsg(null)
    try {
      const t = token()
      const res = await fetch(`${BASE}/tenders/${tenderId}/criteria/extract`, {
        method: "POST",
        headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? `Error ${res.status}`)
      setState("done")
      setMsg(`Extracted ${data.extracted} criteria — refreshing…`)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: unknown) {
      setState("error")
      setMsg((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" onClick={handleExtract} disabled={state === "running"}>
        <HugeiconsIcon icon={state === "running" ? RefreshIcon : AiBrain01Icon} size={12} />
        {state === "running" ? "Extracting with AI…" : "Re-extract Criteria with AI"}
      </Button>
      {msg && (
        <p className={`text-[11px] ${state === "error" ? "text-danger" : "text-success"}`}>{msg}</p>
      )}
    </div>
  )
}

// ── Upload Tender Document ────────────────────────────────────────────────────

export function UploadDocumentButton({ tenderId }: { tenderId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSuccess(null)
    setUploading(true)

    try {
      const form = new FormData()
      form.append("file", file)

      const uploadRes = await authFetch(`/tenders/${tenderId}/upload`, { method: "POST", body: form })
      if (!uploadRes.ok) {
        const b = await uploadRes.json().catch(() => ({}))
        throw new Error(b?.error?.message ?? `Upload failed (${uploadRes.status})`)
      }

      setSuccess(`"${file.name}" uploaded — extracting criteria with AI…`)
      // Run extraction synchronously so criteria are in the DB before the page reloads
      await authFetch(`/tenders/${tenderId}/criteria/extract`, { method: "POST" }).catch(() => null)

      setSuccess(`"${file.name}" uploaded — criteria extracted, refreshing…`)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={handleFile}
          disabled={uploading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <HugeiconsIcon icon={CloudUploadIcon} size={12} />
          {uploading ? "Uploading…" : "Upload RFP / Document"}
        </Button>
      </div>
      {success && <p className="text-[11px] text-success">{success}</p>}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  )
}

import * as React from "react"
import { cn } from "@/lib/utils"

type Tone = "primary" | "success" | "warning" | "danger" | "info"

const toneClass: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
}

function Progress({
  value = 0,
  tone = "primary",
  className,
  trackClassName,
}: {
  value?: number
  tone?: Tone
  className?: string
  trackClassName?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "bg-muted relative h-1.5 w-full overflow-hidden rounded-full",
        trackClassName,
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", toneClass[tone])}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

export { Progress }

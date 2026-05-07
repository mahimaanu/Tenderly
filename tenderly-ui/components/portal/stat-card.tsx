import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "saffron"

const toneClasses: Record<Tone, { ring: string; icon: string; tile: string }> = {
  primary: { ring: "ring-primary/15", icon: "text-primary", tile: "bg-primary/10" },
  success: { ring: "ring-success/15", icon: "text-success", tile: "bg-success-soft" },
  warning: { ring: "ring-warning/20", icon: "text-warning-foreground", tile: "bg-warning-soft" },
  danger:  { ring: "ring-danger/15",  icon: "text-danger",  tile: "bg-danger-soft" },
  info:    { ring: "ring-info/15",    icon: "text-info",    tile: "bg-info-soft" },
  saffron: { ring: "ring-saffron/20", icon: "text-saffron-foreground", tile: "bg-saffron/15" },
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "primary",
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  delta?: { value: string; tone?: "up" | "down" | "neutral" }
  icon?: IconSvgElement
  tone?: Tone
  className?: string
}) {
  const t = toneClasses[tone]
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[11px] tracking-wide font-medium uppercase">
            {label}
          </span>
          <span className="font-heading text-2xl font-semibold tracking-tight">
            {value}
          </span>
          <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
            {hint}
            {delta && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  delta.tone === "up" && "bg-success-soft text-success",
                  delta.tone === "down" && "bg-danger-soft text-danger",
                  (!delta.tone || delta.tone === "neutral") && "bg-muted text-muted-foreground"
                )}
              >
                {delta.value}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              "grid size-10 place-items-center rounded-lg ring-1 ring-inset",
              t.tile,
              t.ring
            )}
          >
            <HugeiconsIcon icon={icon} size={18} strokeWidth={1.7} className={t.icon} />
          </div>
        )}
      </div>
    </Card>
  )
}

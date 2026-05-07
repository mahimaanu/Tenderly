import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import type { Verdict } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const map = {
  eligible: {
    label: "Eligible",
    variant: "success" as const,
    icon: CheckmarkCircle02Icon,
    iconClass: "text-success",
    dotClass: "bg-success",
  },
  ineligible: {
    label: "Not Eligible",
    variant: "danger" as const,
    icon: Cancel01Icon,
    iconClass: "text-danger",
    dotClass: "bg-danger",
  },
  manual_review: {
    label: "Manual Review",
    variant: "warning" as const,
    icon: AlertCircleIcon,
    iconClass: "text-warning-foreground",
    dotClass: "bg-warning",
  },
} as const

export function VerdictBadge({
  verdict,
  size = "default",
  className,
}: {
  verdict: Verdict
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const m = map[verdict]
  return (
    <Badge variant={m.variant} size={size} className={cn("gap-1", className)}>
      <HugeiconsIcon icon={m.icon} size={11} strokeWidth={2} className={m.iconClass} />
      {m.label}
    </Badge>
  )
}

export function VerdictDot({ verdict, className }: { verdict: Verdict; className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full", map[verdict].dotClass, className)} />
}

export const verdictMeta = map

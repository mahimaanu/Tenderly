import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Note02Icon,
  BalanceScaleIcon,
  Building01Icon,
  Award01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import type { Criterion, CriterionType } from "@/lib/types"
import { cn } from "@/lib/utils"

const typeMeta: Record<
  CriterionType,
  { label: string; icon: typeof Note02Icon; tile: string; tone: "info" | "default" | "saffron" | "muted" }
> = {
  financial: { label: "Financial", icon: BalanceScaleIcon, tile: "bg-info-soft text-info", tone: "info" },
  technical: { label: "Technical", icon: Building01Icon, tile: "bg-primary/10 text-primary", tone: "default" },
  compliance: { label: "Compliance", icon: Award01Icon, tile: "bg-saffron/15 text-saffron-foreground", tone: "saffron" },
  documentation: { label: "Documentation", icon: Note02Icon, tile: "bg-muted text-muted-foreground", tone: "muted" },
}

export function CriterionCard({
  criterion,
  className,
  compact = false,
}: {
  criterion: Criterion
  className?: string
  compact?: boolean
}) {
  const m = typeMeta[criterion.type]
  return (
    <div
      className={cn(
        "border-border/70 bg-card relative flex gap-3 rounded-xl border p-4",
        className
      )}
    >
      <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", m.tile)}>
        <HugeiconsIcon icon={m.icon} size={16} strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] text-muted-foreground">{criterion.code}</span>
          <Badge variant={m.tone} size="sm">
            {m.label}
          </Badge>
          {criterion.mandatory ? (
            <Badge variant="danger" size="sm">
              <HugeiconsIcon icon={AlertCircleIcon} size={9} /> Mandatory
            </Badge>
          ) : (
            <Badge variant="muted" size="sm">Optional</Badge>
          )}
        </div>
        <h4 className="font-heading mt-1.5 text-sm font-semibold leading-snug">
          {criterion.title}
        </h4>
        {!compact && (
          <>
            <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
              {criterion.requirement}
            </p>
            <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-32 shrink-0 font-medium">Expected format</span>
                <span className="font-mono text-foreground/80">{criterion.expectedFormat}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-32 shrink-0 font-medium">Acceptable evidence</span>
                <ul className="flex-1 space-y-0.5">
                  {criterion.evidenceHints.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={10} className="text-success mt-0.5 shrink-0" />
                      <span className="text-foreground/80">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

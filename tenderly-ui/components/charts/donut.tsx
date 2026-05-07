import * as React from "react"
import { cn } from "@/lib/utils"

export type DonutSlice = {
  label: string
  value: number
  color: string
}

export function DonutChart({
  data,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
}: {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: React.ReactNode
  centerValue?: React.ReactNode
  className?: string
}) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.93 0.01 240)"
          strokeWidth={thickness}
        />
        {data.map((s, i) => {
          const len = (s.value / total) * c
          const dash = `${len} ${c - len}`
          const dashOffset = -offset
          offset += len
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-heading text-2xl leading-none font-semibold">{centerValue}</span>
        {centerLabel && (
          <span className="text-muted-foreground mt-1 text-[11px] leading-tight">{centerLabel}</span>
        )}
      </div>
    </div>
  )
}

export function DonutLegend({ data, className }: { data: DonutSlice[]; className?: string }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {data.map((s, i) => {
        const pct = Math.round((s.value / total) * 100)
        return (
          <li key={i} className="flex items-center gap-2.5 text-xs">
            <span
              className="inline-block size-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="font-mono tabular-nums text-foreground font-medium">
              {s.value}
            </span>
            <span className="text-muted-foreground w-9 text-right tabular-nums text-[11px]">
              {pct}%
            </span>
          </li>
        )
      })}
    </ul>
  )
}

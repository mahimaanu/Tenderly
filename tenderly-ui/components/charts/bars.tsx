import * as React from "react"
import { cn } from "@/lib/utils"

export type BarRow = {
  label: string
  values: { color: string; value: number; tone?: "success" | "danger" | "warning" | "info" }[]
  meta?: React.ReactNode
}

export function StackedBarChart({
  rows,
  max,
  className,
  showAxis = true,
}: {
  rows: BarRow[]
  max?: number
  className?: string
  showAxis?: boolean
}) {
  const computedMax = max ?? Math.max(...rows.map((r) => r.values.reduce((a, b) => a + b.value, 0)))

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {rows.map((row, i) => {
        const total = row.values.reduce((a, b) => a + b.value, 0)
        return (
          <div key={i} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3">
            <div className="text-xs truncate font-medium">{row.label}</div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              {row.values.map((v, j) => (
                <div
                  key={j}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(v.value / computedMax) * 100}%`,
                    background: v.color,
                  }}
                  title={`${v.value}`}
                />
              ))}
            </div>
            <div className="text-foreground/80 font-mono tabular-nums text-[11px]">
              {row.meta ?? total}
            </div>
          </div>
        )
      })}
      {showAxis && (
        <div className="ml-[152px] mr-[34px] flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>{Math.round(computedMax / 2)}</span>
          <span>{computedMax}</span>
        </div>
      )}
    </div>
  )
}

export function BarChart({
  data,
  height = 160,
  color = "var(--primary)",
  className,
}: {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-medium tabular-nums text-foreground/80">
              {d.value}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${(d.value / max) * 88}%`,
                background: color,
                minHeight: 4,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {data.map((d, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[10px] text-muted-foreground truncate"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

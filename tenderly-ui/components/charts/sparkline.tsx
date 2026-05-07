import * as React from "react"

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "var(--primary)",
  fill = true,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  className?: string
}) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width

  const points = data
    .map((d, i) => `${i * step},${height - ((d - min) / range) * (height - 4) - 2}`)
    .join(" ")

  const area = `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      {fill && (
        <path
          d={area}
          fill={color}
          opacity={0.12}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ConfidenceMeter({
  value,
  className,
}: {
  value: number // 0..1
  className?: string
}) {
  const pct = Math.round(value * 100)
  const tone =
    value >= 0.85 ? "var(--success)" : value >= 0.6 ? "var(--warning)" : "var(--danger)"

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="bg-muted relative h-1 w-20 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: tone }}
        />
      </div>
      <span
        className="font-mono text-[10.5px] tabular-nums font-medium"
        style={{ color: tone }}
      >
        {pct}%
      </span>
    </div>
  )
}

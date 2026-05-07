import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()

  // deterministic color
  const palette = [
    "bg-blue-100 text-blue-700",
    "bg-amber-100 text-amber-800",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  const c = palette[Math.abs(h) % palette.length]

  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        c,
        className
      )}
      aria-label={name}
    >
      {initials || "?"}
    </span>
  )
}

export { Avatar }

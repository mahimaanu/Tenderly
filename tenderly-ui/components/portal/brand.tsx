import Link from "next/link"
import { cn } from "@/lib/utils"

export function Brand({
  href = "/",
  className,
  compact = false,
}: {
  href?: string
  className?: string
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 select-none",
        className
      )}
    >
      <span className="relative inline-flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none">
          <path
            d="M12 2.5l8.5 4v6.2c0 4.6-3.5 8.4-8.5 9.3-5-.9-8.5-4.7-8.5-9.3V6.5L12 2.5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 12.2l2.6 2.6L16 9.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute right-0.5 bottom-0.5 size-1.5 rounded-full bg-saffron" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-heading text-sm font-semibold tracking-tight">Tenderly</span>
          <span className="text-[9.5px] tracking-wide text-muted-foreground uppercase">
            CRPF · Procurement
          </span>
        </span>
      )}
    </Link>
  )
}

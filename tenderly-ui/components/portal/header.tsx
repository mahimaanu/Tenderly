import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification03Icon, Search01Icon, HelpCircleIcon, Logout03Icon } from "@hugeicons/core-free-icons"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function PortalHeader({
  user,
  role,
  context,
}: {
  user: { name: string; subline: string }
  role: "Officer" | "Bidder"
  context?: React.ReactNode
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 px-5 backdrop-blur">
      <div className="flex flex-1 items-center gap-3">
        {context}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              strokeWidth={1.8}
              className="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2"
            />
            <input
              placeholder="Search tenders, bidders, criteria…"
              className="bg-muted/60 placeholder:text-muted-foreground/80 h-8 w-72 rounded-md border-0 pl-8 text-xs outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            className="text-muted-foreground hover:text-foreground hover:bg-muted relative grid size-8 place-items-center rounded-md"
            aria-label="Notifications"
          >
            <HugeiconsIcon icon={Notification03Icon} size={16} strokeWidth={1.7} />
            <span className="bg-saffron absolute top-1.5 right-1.5 size-1.5 rounded-full" />
          </button>
          <button
            className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-8 place-items-center rounded-md"
            aria-label="Help"
          >
            <HugeiconsIcon icon={HelpCircleIcon} size={16} strokeWidth={1.7} />
          </button>
          <div className="bg-border mx-1 h-5 w-px" />
          <a
            href="/api/logout"
            className="hover:bg-muted flex items-center gap-2 rounded-md p-1 pr-2"
            title="Sign out"
          >
            <Avatar name={user.name} className="size-7" />
            <div className="hidden flex-col text-left leading-tight md:flex">
              <span className="text-xs font-medium">{user.name}</span>
              <span className="text-muted-foreground text-[10px]">
                {role} · {user.subline}
              </span>
            </div>
            <HugeiconsIcon
              icon={Logout03Icon}
              size={13}
              strokeWidth={1.8}
              className="text-muted-foreground ml-1"
            />
          </a>
        </div>
      </div>
    </header>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 pb-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight md:text-[22px]">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed md:text-[13px]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
    </div>
  )
}

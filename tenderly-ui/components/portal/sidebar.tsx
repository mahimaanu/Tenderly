"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { Brand } from "./brand"

export type NavItem = {
  href: string
  label: string
  icon: IconSvgElement
  badge?: string | number
  match?: "exact" | "prefix"
}

export type NavSection = {
  label?: string
  items: NavItem[]
}

export function Sidebar({
  sections,
  footer,
}: {
  sections: NavSection[]
  footer?: React.ReactNode
}) {
  const pathname = usePathname()

  const isActive = (item: NavItem) => {
    if (item.match === "exact") return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r lg:flex">
      <div className="border-sidebar-border flex h-14 items-center border-b px-4">
        <Brand />
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {section.label && (
              <div className="text-muted-foreground mb-1 px-2 text-[10px] font-medium tracking-wider uppercase">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={16}
                    strokeWidth={1.7}
                    className={cn(
                      "shrink-0",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="bg-saffron/15 text-saffron-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-semibold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {footer && (
        <div className="border-sidebar-border border-t p-3">{footer}</div>
      )}
    </aside>
  )
}

import * as React from "react"
import { Sidebar, type NavSection } from "./sidebar"
import { PortalHeader } from "./header"

export function PortalShell({
  sections,
  user,
  role,
  context,
  sidebarFooter,
  children,
}: {
  sections: NavSection[]
  user: { name: string; subline: string }
  role: "Officer" | "Bidder"
  context?: React.ReactNode
  sidebarFooter?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh">
      <Sidebar sections={sections} footer={sidebarFooter} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader user={user} role={role} context={context} />
        <main className="flex-1 px-5 py-5 lg:px-7 lg:py-6">{children}</main>
        <footer className="border-t border-border/70 px-5 py-3 lg:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
            <span>
              © Tenderly v0.1 (prototype)
            </span>
            <span className="flex items-center gap-2">
              <span className="accent-stripe inline-block h-1.5 w-6 rounded-full" />
              Built for procurement transparency
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

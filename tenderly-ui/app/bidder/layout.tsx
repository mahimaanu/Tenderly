import * as React from "react"

export const dynamic = "force-dynamic"
import {
  DashboardSquare01Icon,
  Folder01Icon,
  Files01Icon,
  Note02Icon,
  ContactBookIcon,
  Settings02Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PortalShell } from "@/components/portal/shell"
import { bidder } from "@/lib/mock-data"
import type { NavSection } from "@/components/portal/sidebar"
import { listSubmissions, getClarifications } from "@/lib/api/bidder-api"

export default async function BidderLayout({ children }: { children: React.ReactNode }) {
  const [submissions, clarifications] = await Promise.all([
    listSubmissions().catch(() => []),
    getClarifications().catch(() => []),
  ])

  const openClarifications = clarifications.filter((c) => c.status === "open").length

  const sections: NavSection[] = [
    {
      items: [
        { href: "/bidder", label: "Dashboard", icon: DashboardSquare01Icon, match: "exact" },
        { href: "/bidder/tenders", label: "Browse Tenders", icon: Folder01Icon },
        { href: "/bidder/submissions", label: "My Submissions", icon: Files01Icon, badge: submissions.length || undefined },
        { href: "/bidder/clarifications", label: "Clarifications", icon: Note02Icon, badge: openClarifications || undefined },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/bidder/profile", label: "Company Profile", icon: ContactBookIcon },
        { href: "/bidder/settings", label: "Settings", icon: Settings02Icon },
      ],
    },
  ]

  return (
    <PortalShell
      role="Bidder"
      user={{ name: bidder.contact, subline: bidder.designation }}
      sections={sections}
      sidebarFooter={
        <div className="flex items-start gap-2.5 rounded-lg bg-success-soft p-3 ring-1 ring-success/15 ring-inset">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-success text-success-foreground">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11px] font-medium">{bidder.name}</p>
            <p className="text-muted-foreground text-[10px] leading-snug">
              KYC Verified · GSTIN {bidder.gstin}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </PortalShell>
  )
}

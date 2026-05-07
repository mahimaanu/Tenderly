import * as React from "react"

export const dynamic = "force-dynamic"
import {
  DashboardSquare01Icon,
  Folder01Icon,
  CheckListIcon,
  Analytics02Icon,
  TimelineIcon,
  Settings02Icon,
  ContactBookIcon,
  ShieldUserIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { PortalShell } from "@/components/portal/shell"
import { getOfficerProfile } from "@/lib/api/officer"
import type { NavSection } from "@/components/portal/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { getManualReviewQueue } from "@/lib/api/evaluations"

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
  const [{ count }, profile] = await Promise.all([
    getManualReviewQueue({ count_only: true }).catch(() => ({ count: 0, items: [], total: 0 })),
    getOfficerProfile(),
  ])
  const manualReviewCount = count ?? 0

  const sections: NavSection[] = [
    {
      items: [
        { href: "/officer", label: "Dashboard", icon: DashboardSquare01Icon, match: "exact" },
        { href: "/officer/tenders", label: "Tenders", icon: Folder01Icon },
        { href: "/officer/manual-review", label: "Manual Review", icon: CheckListIcon, badge: manualReviewCount || undefined },
        { href: "/officer/reports", label: "Reports & Analytics", icon: Analytics02Icon },
        { href: "/officer/audit", label: "Audit Trail", icon: TimelineIcon },
      ],
    },
    {
      label: "Workspace",
      items: [
        { href: "/officer/evaluations", label: "All Evaluations", icon: UserMultiple02Icon },
        { href: "/officer/bidders", label: "Bidder Directory", icon: ContactBookIcon },
        { href: "/officer/settings", label: "Settings", icon: Settings02Icon },
      ],
    },
  ]

  return (
    <PortalShell
      role="Officer"
      user={{ name: profile.name, subline: profile.designation ?? profile.role }}
      sections={sections}
      sidebarFooter={
        <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 p-3 ring-1 ring-primary/10 ring-inset">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <HugeiconsIcon icon={ShieldUserIcon} size={14} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11px] font-medium">Verified Officer Access</p>
            <p className="text-muted-foreground text-[10px] leading-snug">
              {profile.emp_id ?? profile.email}{profile.unit ? ` · ${profile.unit}` : ""}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </PortalShell>
  )
}

import { HugeiconsIcon } from "@hugeicons/react"
import { FingerPrintIcon, Mail01Icon, ShieldUserIcon, AiBrain01Icon } from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/portal/header"
import { getBidderSettings, getSignatories } from "@/lib/api/bidder-api"

export default async function BidderSettings() {
  const [settings, signatories] = await Promise.all([
    getBidderSettings().catch(() => null),
    getSignatories().catch(() => []),
  ])

  return (
    <>
      <PageHeader title="Settings" description="Manage your DSC certificate, signatories, and notification preferences." />

      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <HugeiconsIcon icon={FingerPrintIcon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Digital Signature Certificate</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Class 3 DSC · Used for bid signing</p>
            <Badge variant="success" className="mt-2">Valid</Badge>
          </div>
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={FingerPrintIcon} size={12} /> Re-verify DSC
          </Button>
        </div>
      </Card>

      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <HugeiconsIcon icon={ShieldUserIcon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Authorised Signatories</h3>
        </div>
        {(signatories as unknown[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No signatories added yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(signatories as Record<string, unknown>[]).map((s, i) => (
              <li key={String(s.id ?? i)} className="py-2 text-sm">{String(s.name ?? "")}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <HugeiconsIcon icon={AiBrain01Icon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Pre-bid Eligibility Hints</h3>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" defaultChecked={settings?.pre_bid_hints !== false} className="rounded border-border" />
          <div>
            <p className="text-sm font-medium">Show eligibility hints before submitting</p>
            <p className="text-[11px] text-muted-foreground">The AI will check your profile against criteria and highlight gaps.</p>
          </div>
        </label>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <HugeiconsIcon icon={Mail01Icon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "Evaluation complete", key: "evaluation_complete" },
            { label: "Clarification requested", key: "clarification_request" },
            { label: "Award decision", key: "award_decision" },
          ].map((n) => (
            <label key={n.key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked={settings?.notifications?.[n.key] !== false} className="rounded border-border" />
              <span className="text-sm">{n.label}</span>
            </label>
          ))}
        </div>
        <Button className="mt-4" size="sm">Save</Button>
      </Card>
    </>
  )
}

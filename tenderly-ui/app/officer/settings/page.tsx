import { HugeiconsIcon } from "@hugeicons/react"
import { ShieldUserIcon, AiBrain01Icon, FingerPrintIcon, Mail01Icon } from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/portal/header"
import { getOfficerProfile, getOfficerPreferences } from "@/lib/api/officer"
import { getMe } from "@/lib/api/auth"
import { getServerToken } from "@/lib/auth/session"

export default async function OfficerSettings() {
  const token = await getServerToken()
  const [profile, prefs] = await Promise.all([
    getOfficerProfile().catch(() => null),
    getOfficerPreferences().catch(() => null),
  ])

  const user = token
    ? await getMe(token).catch(() => null)
    : null

  const name = profile?.name ?? user?.name ?? ""
  const email = profile?.email ?? user?.email ?? ""
  const designation = profile?.designation ?? user?.designation ?? ""
  const unit = profile?.unit ?? user?.unit ?? ""

  return (
    <>
      <PageHeader title="Settings" description="Manage your officer profile, evaluation preferences, and DSC certificate." />

      {/* Identity */}
      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-5">
          <HugeiconsIcon icon={ShieldUserIcon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Officer Identity</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Full name</Label>
            <Input className="mt-1" defaultValue={name} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input className="mt-1" defaultValue={email} type="email" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Designation</Label>
            <Input className="mt-1" defaultValue={designation} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Unit</Label>
            <Input className="mt-1" defaultValue={unit} />
          </div>
        </div>
        <Button className="mt-4" size="sm">Save changes</Button>
      </Card>

      {/* Thresholds */}
      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-5">
          <HugeiconsIcon icon={AiBrain01Icon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Evaluation Thresholds</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Confidence floor (flags for manual review below this)</Label>
            <Input className="mt-1 font-mono" defaultValue={prefs?.confidence_floor ?? 0.75} type="number" min={0} max={1} step={0.01} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">OCR quality floor</Label>
            <Input className="mt-1 font-mono" defaultValue={prefs?.ocr_floor ?? 0.70} type="number" min={0} max={1} step={0.01} />
          </div>
        </div>
        <Button className="mt-4" size="sm">Save preferences</Button>
      </Card>

      {/* DSC */}
      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <HugeiconsIcon icon={FingerPrintIcon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Digital Signature Certificate</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Class 3 DSC · Expires 14 Aug 2027</p>
            <Badge variant="success" className="mt-2">Valid</Badge>
          </div>
          <Button variant="outline" size="sm">
            <HugeiconsIcon icon={FingerPrintIcon} size={12} /> Re-verify DSC
          </Button>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <HugeiconsIcon icon={Mail01Icon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "Bid submitted", key: "bid_submitted" },
            { label: "Evaluation complete", key: "evaluation_complete" },
            { label: "Manual review needed", key: "manual_review" },
            { label: "Clarification replied", key: "clarification_replied" },
          ].map((n) => (
            <label key={n.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={prefs?.notifications?.[n.key] !== false}
                className="rounded border-border"
              />
              <span className="text-sm">{n.label}</span>
            </label>
          ))}
        </div>
        <Button className="mt-4" size="sm">Save</Button>
      </Card>
    </>
  )
}

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ContactBookIcon,
  Mail01Icon,
  Building01Icon,
  Call02Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/portal/header"
import { getBidderProfile, getCertifications } from "@/lib/api/bidder-api"

export default async function BidderProfile() {
  const [profile, certifications] = await Promise.all([
    getBidderProfile().catch(() => null),
    getCertifications().catch(() => []),
  ])

  return (
    <>
      <PageHeader title="Company Profile" description="Your company information shown to procurement officers during evaluation." />

      <Card className="mb-4 p-6">
        <div className="flex items-center gap-3 mb-5">
          <HugeiconsIcon icon={Building01Icon} size={16} className="text-primary" />
          <h3 className="font-heading text-sm font-semibold">Company Information</h3>
          {profile?.kyc_verified && <Badge variant="success">KYC Verified</Badge>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Company Name</Label>
            <Input className="mt-1" defaultValue={profile?.company_name ?? ""} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Registration Number</Label>
            <Input className="mt-1 font-mono" defaultValue={profile?.registration_number ?? ""} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">GSTIN</Label>
            <Input className="mt-1 font-mono" defaultValue={profile?.gstin ?? ""} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Contact Person</Label>
            <Input className="mt-1" defaultValue={profile?.contact_person ?? ""} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input className="mt-1" type="email" defaultValue={profile?.email ?? ""} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input className="mt-1" defaultValue={profile?.phone ?? ""} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">City</Label>
            <Input className="mt-1" defaultValue={profile?.city ?? ""} />
          </div>
        </div>
        <Button className="mt-4" size="sm">Save changes</Button>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HugeiconsIcon icon={ContactBookIcon} size={16} className="text-primary" />
            <h3 className="font-heading text-sm font-semibold">Certifications</h3>
          </div>
          <Button size="sm" variant="outline">Upload Certificate</Button>
        </div>
        {(certifications as unknown[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">No certifications uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(certifications as Record<string, unknown>[]).map((cert, i) => (
              <li key={String(cert.id ?? i)} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{String(cert.name ?? "")}</p>
                  <p className="text-[11px] text-muted-foreground">{String(cert.issuing_body ?? "")}</p>
                </div>
                {cert.expires_on && (
                  <span className="text-[11px] text-muted-foreground">Expires {String(cert.expires_on)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

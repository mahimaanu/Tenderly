import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Shield01Icon,
  UserGroupIcon,
  CheckmarkCircle02Icon,
  EyeIcon,
  Note02Icon,
  AiBrain01Icon,
  Doc01Icon,
  FileScanIcon,
  Camera02Icon,
  File02Icon,
  BalanceScaleIcon,
  TaskDone01Icon,
  AlertCircleIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Brand } from "@/components/portal/brand"

export default function LandingPage() {
  return (
    <div className="hero-bg min-h-svh">
      {/* accent stripe */}
      <div className="accent-stripe h-1 w-full" />

      {/* Top bar */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Brand />
        <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">How it works</a>
          <a href="#trust" className="hover:text-foreground">Trust & audit</a>
          <a href="#contact" className="hover:text-foreground">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/officer-login"
            className="text-muted-foreground hover:text-foreground hidden text-xs font-medium md:inline"
          >
            Officer sign in
          </Link>
          <Button asChild size="lg">
            <Link href="/bidder-login">
              Bidder sign in
              <HugeiconsIcon icon={ArrowRight02Icon} size={14} />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-8 lg:pt-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7 lg:pr-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[10.5px] font-medium tracking-wide text-muted-foreground">
              <span className="accent-stripe inline-block h-1.5 w-3 rounded-full" />
              AI-Powered Procurement
              <span className="text-foreground/60">·</span>
              <span className="text-success">Pilot Programme · 2026</span>
            </div>
            <h1 className="font-heading mt-5 text-4xl leading-[1.05] font-semibold tracking-tight md:text-[52px]">
              Tender evaluation for
              <span className="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                {" "}
                any organisation
              </span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-sm leading-relaxed md:text-base">
              Tenderly helps procurement officers read every tender, every bid, and every
              supporting document — including scans and photographs — and produce an{" "}
              <span className="text-foreground font-medium">explainable, auditable verdict</span>{" "}
              for each bidder against each criterion. No bidder is silently disqualified.
            </p>

            {/* <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-10 px-5 text-sm">
                <Link href="/officer-login">
                  <HugeiconsIcon icon={Shield01Icon} size={14} />
                  Open Officer Portal
                  <HugeiconsIcon icon={ArrowRight02Icon} size={14} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-10 px-5 text-sm">
                <Link href="/bidder-login">
                  <HugeiconsIcon icon={UserGroupIcon} size={14} />
                  Open Bidder Portal
                </Link>
              </Button>
            </div>  */}

            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { i: CheckmarkCircle02Icon, t: "Criterion-level explainability for every verdict" },
                { i: EyeIcon, t: "End-to-end audit trail of every automated decision" },
                { i: AlertCircleIcon, t: "Ambiguous cases surfaced for human review — never silently rejected" },
                { i: FileScanIcon, t: "Reads typed PDFs, scans, photographs and Word files" },
              ].map((it, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-success-soft">
                    <HugeiconsIcon icon={it.i} size={11} strokeWidth={2} className="text-success" />
                  </span>
                  <span className="text-foreground/80">{it.t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Portal cards */}
          <div className="lg:col-span-5">
            <div className="grid gap-4">
              <PortalCard
                href="/officer-login"
                role="For Procurement Officers"
                title="Officer Portal"
                description="Upload a tender. Receive criterion-by-criterion evaluations for every bidder with verdict, evidence and confidence."
                icon={Shield01Icon}
                tone="primary"
                features={[
                  "Auto-extract eligibility criteria",
                  "Side-by-side bidder comparison",
                  "Manual review queue & audit trail",
                  "Signed evaluation reports (PDF)",
                ]}
                cta="Sign in as officer"
              />
              <PortalCard
                href="/bidder-login"
                role="For Vendors & Contractors"
                title="Bidder Portal"
                description="Discover open tenders, upload your bid documents, track status and respond to clarification requests."
                icon={UserGroupIcon}
                tone="saffron"
                features={[
                  "Browse open tenders",
                  "Guided document checklist",
                  "Live submission status",
                  "Respond to manual review requests",
                ]}
                cta="Sign in as bidder"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="features" className="border-t border-border/70 bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-muted-foreground text-[10.5px] font-medium tracking-widest uppercase">
                Workflow
              </span>
              <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                From tender document to signed verdict — in one workflow.
              </h2>
            </div>
            <span className="text-muted-foreground text-xs">
              Worked example: Construction services tender · 4 criteria · 10 bidders
            </span>
          </div>

          <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                icon: Note02Icon,
                title: "Understand the tender",
                body: "System extracts every eligibility criterion — financial, technical, compliance, documentation — and labels each as mandatory or optional.",
              },
              {
                n: "02",
                icon: AiBrain01Icon,
                title: "Understand each bidder",
                body: "Reads typed PDFs, scans, photographs and Word files. Pulls the value & evidence relevant to each criterion, even when bidders present it differently.",
              },
              {
                n: "03",
                icon: BalanceScaleIcon,
                title: "Evaluate & explain",
                body: "Decides Eligible / Not Eligible / Manual Review per criterion and overall — with the document, page and value that drove each decision.",
              },
              {
                n: "04",
                icon: TaskDone01Icon,
                title: "Sign-off & audit",
                body: "Procurement officer reviews ambiguous cases, signs the consolidated report, and exports a complete audit trail for record.",
              },
            ].map((step, i) => (
              <li key={i} className="bg-card border-border/70 relative flex flex-col gap-3 rounded-xl border p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={step.icon} size={18} strokeWidth={1.7} />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{step.n}</span>
                </div>
                <h3 className="font-heading text-sm font-semibold tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>

          {/* Document type chips */}
          <div className="mt-10 rounded-xl border border-border/70 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-muted-foreground text-[10.5px] font-medium tracking-widest uppercase">
                  Handles every document format procurement actually receives
                </span>
                <p className="font-heading mt-1 text-sm font-semibold">
                  Typed PDFs · Scanned PDFs · Photographs · Word documents
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {[
                  { i: Doc01Icon, l: "Typed PDF" },
                  { i: FileScanIcon, l: "Scanned PDF" },
                  { i: Camera02Icon, l: "Photograph" },
                  { i: File02Icon, l: "Word .docx" },
                ].map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1"
                  >
                    <HugeiconsIcon icon={c.i} size={12} strokeWidth={1.7} className="text-primary" />
                    {c.l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sample scenario */}
      <section id="trust" className="border-t border-border/70">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="text-muted-foreground text-[10.5px] font-medium tracking-widest uppercase">
                Sample scenario
              </span>
              <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                10 bidders. 4 criteria. One report a procurement officer can sign.
              </h2>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                An organisation issues a tender for construction services. Tenderly extracts
                the eligibility criteria from the document, parses every bidder submission, and
                produces a consolidated report — with each verdict tied back to the specific
                criterion, document and value that drove it.
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="h-10 px-5 text-sm">
                  <Link href="/officer/tenders/tender-001">
                    Walk through the worked example
                    <HugeiconsIcon icon={ArrowRight02Icon} size={14} />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="grid gap-3 sm:grid-cols-3">
                <ResultCard tone="success" icon={CheckmarkCircle02Icon} value="6" label="Clearly Eligible" detail="With evidence for every criterion" />
                <ResultCard tone="danger" icon={Cancel01Icon} value="3" label="Clearly Ineligible" detail="With the failing criterion cited" />
                <ResultCard tone="warning" icon={AlertCircleIcon} value="1" label="Manual Review" detail="Scanned figure not legible — flagged" />
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-card p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 place-items-center rounded-md bg-warning-soft">
                    <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={1.8} className="text-warning-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      Why was Vindhya Construction LLP flagged for manual review?
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      Their CA turnover certificate is a low-resolution photograph. The crore figure on
                      <span className="text-foreground"> page 1, line 14</span> is partially obscured by
                      a stamp. OCR cannot disambiguate <span className="font-mono">'5'</span> vs{" "}
                      <span className="font-mono">'3'</span>. Confidence:{" "}
                      <span className="text-warning-foreground font-mono">42%</span>.
                    </p>
                    <p className="text-foreground/80 mt-2 text-xs">
                      → Sent to officer review queue. Re-upload requested. <span className="text-muted-foreground">Audit logged.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-border/70 bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Brand />
            <span className="ml-2">Built for procurement transparency.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
            <span>v0.1 prototype</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Hero portal card ----------------------------------------------------------

function PortalCard({
  href,
  role,
  title,
  description,
  icon,
  tone,
  features,
  cta,
}: {
  href: string
  role: string
  title: string
  description: string
  icon: typeof Shield01Icon
  tone: "primary" | "saffron"
  features: string[]
  cta: string
}) {
  const tile = tone === "primary"
    ? "bg-primary text-primary-foreground"
    : "bg-saffron/15 text-saffron-foreground ring-1 ring-saffron/20 ring-inset"

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-11 place-items-center rounded-xl ${tile}`}>
          <HugeiconsIcon icon={icon} size={22} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground text-[10.5px] font-medium tracking-wider uppercase">
            {role}
          </span>
          <h3 className="font-heading mt-0.5 text-base font-semibold tracking-tight">
            {title}
          </h3>
        </div>
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          size={16}
          strokeWidth={1.8}
          className="text-muted-foreground group-hover:text-foreground translate-x-0 transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{description}</p>
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="text-foreground/80 flex items-start gap-1.5 text-[11px]">
            <span className="mt-1 inline-block size-1 rounded-full bg-foreground/40" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs font-medium">{cta}</span>
        <span className="text-muted-foreground text-[10.5px]">Single Sign-On</span>
      </div>
    </Link>
  )
}

function ResultCard({
  tone,
  icon,
  value,
  label,
  detail,
}: {
  tone: "success" | "danger" | "warning"
  icon: typeof CheckmarkCircle02Icon
  value: string
  label: string
  detail: string
}) {
  const m = {
    success: { tile: "bg-success-soft", iconC: "text-success", valueC: "text-success" },
    danger: { tile: "bg-danger-soft", iconC: "text-danger", valueC: "text-danger" },
    warning: { tile: "bg-warning-soft", iconC: "text-warning-foreground", valueC: "text-warning-foreground" },
  }[tone]
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className={`grid size-9 place-items-center rounded-lg ${m.tile}`}>
          <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} className={m.iconC} />
        </span>
        <span className={`font-heading text-3xl font-semibold ${m.valueC}`}>{value}</span>
      </div>
      <p className="mt-2 text-xs font-medium">{label}</p>
      <p className="text-muted-foreground text-[11px] leading-relaxed">{detail}</p>
    </div>
  )
}

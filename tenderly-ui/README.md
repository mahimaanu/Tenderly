# Tenderly — CRPF Tender Evaluation Platform (UI Prototype)

A two-portal UI prototype for an AI-assisted, auditable, explainable tender
evaluation system designed for the **Central Reserve Police Force (CRPF)**
Procurement Wing under the Ministry of Home Affairs, Government of India.

> Built for Round 1 of the AI Bharat Hackathon. This is the UI shell — every
> page, navigation flow, and chart is functional, but document parsing /
> evaluation logic runs on **mock data** that mirrors the official problem
> statement's worked example (1 tender · 4 criteria · 10 bidders · 6 eligible /
> 3 ineligible / 1 manual review).

---

## Two portals, one workflow

| Portal | Path | Who uses it |
|---|---|---|
| **CRPF Officer** | `/officer` | Procurement officers — upload tenders, view extracted criteria, review per-criterion verdicts, action the manual-review queue, export signed reports |
| **Bidder** | `/bidder` | Vendors / contractors — discover open tenders, upload bid documents, track submission status, respond to clarification requests |

Both portals share a common shell, navigation, and design system. Pick a portal
from the landing page (`/`).

---

## What the prototype demonstrates

The prototype walks through the **exact sample scenario** in the problem
statement:

> A government department issues a tender for construction services with the
> following eligibility criteria: a minimum annual turnover of ₹5 crore, at
> least 3 similar projects completed in the last 5 years, a valid GST
> registration, and an ISO 9001 certification. Ten bidders submit responses…
> 6 eligible, 3 ineligible, 1 flagged for manual review because the turnover
> document is a scanned certificate with figures that could not be read with
> confidence.

The prototype shows:

- **Criterion extraction** from the tender document (auto-extracted into
  editable cards with type, mandatory flag, expected format, evidence hints)
- **Per-bidder, per-criterion evaluation** — verdict, value extracted, source
  document, page reference, system reasoning, and a confidence score
- **No silent disqualification** — ambiguous cases (the 1/10 bidder with the
  unreadable scan) are routed to a Manual Review queue with the specific
  reason
- **Multi-format ingestion** — typed PDFs, scanned PDFs, photographs and
  Word .docx files are all represented (with OCR confidence indicators)
- **Audit trail** — every system + officer + bidder action is timestamped
  and tagged
- **Consolidated, signable report** — government-style PDF layout with
  three-tier sign-off (officer · recommending authority · approving authority)

---

## Quick start

See [`SETUP.md`](./SETUP.md) for full setup instructions.

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## Routes

### Public
- `/` — landing page (portal selector + workflow explainer)

### CRPF Officer (`/officer/*`)
- `/officer` — dashboard
- `/officer/tenders` — all tenders in your wing
- `/officer/tenders/[id]` — tender detail (Overview · Criteria · Bidders ·
  Consolidated Report · Tender Document · Audit)
- `/officer/tenders/[id]/bidders/[bidderId]` — **per-bidder evaluation** with
  criterion-by-criterion explainability
- `/officer/manual-review` — manual review queue
- `/officer/reports` — cross-tender analytics
- `/officer/audit` — full audit trail
- `/officer/bidders` — bidder directory
- `/officer/settings`

### Bidder (`/bidder/*`)
- `/bidder` — dashboard
- `/bidder/tenders` — browse open tenders
- `/bidder/tenders/[id]` — tender detail with pre-eligibility check
- `/bidder/tenders/[id]/submit` — guided bid submission with document
  checklist & camera capture
- `/bidder/submissions` — my submissions
- `/bidder/submissions/[id]` — submission tracking timeline
- `/bidder/clarifications` — officer clarification inbox
- `/bidder/profile` — company profile & certifications
- `/bidder/settings`

### Suggested walkthrough
1. `/` — landing page
2. `/officer` — see the dashboard
3. `/officer/tenders/tender-001` — open the under-evaluation tender
4. Click the **Bidders** tab, then click **Vindhya Construction LLP**
   (`/officer/tenders/tender-001/bidders/bidder-9`) — this is the
   manual-review case with the unreadable scan
5. `/officer/manual-review` — the queue with action buttons
6. Open the **Consolidated Report** tab on the tender page — the
   signable report
7. Switch to `/bidder` to see the same tender from the bidder side

---

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Tailwind CSS v4** (CSS-variable theme, no JS config)
- **shadcn/ui** primitives, **radix-ui** under the hood
- **Hugeicons** (free icon set)
- **TypeScript strict**
- All charts are **hand-rolled SVG** — no chart library, no runtime
  dependencies for visualisations

---

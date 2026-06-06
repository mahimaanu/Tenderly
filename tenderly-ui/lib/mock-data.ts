import type {
  AuditEvent,
  Bidder,
  CriterionEvaluation,
  Tender,
} from "./types"

// ---------------------------------------------------------------------------
// Sample tender — verbatim from the official problem statement scenario
// ---------------------------------------------------------------------------

const criteria = [
  {
    id: "c1",
    code: "FIN-01",
    type: "financial" as const,
    title: "Minimum annual turnover",
    requirement:
      "Average annual turnover of ≥ ₹5,00,00,000 (Rupees Five Crore) in any of the last three financial years (FY 2021-22, 2022-23, 2023-24).",
    mandatory: true,
    expectedFormat: "₹ value (Crore) — extracted from audited balance sheet / CA certificate",
    evidenceHints: [
      "Audited balance sheet attested by Chartered Accountant",
      "CA-issued turnover certificate (UDIN must be present)",
    ],
  },
  {
    id: "c2",
    code: "TEC-01",
    type: "technical" as const,
    title: "Past similar project experience",
    requirement:
      "Minimum 3 (three) similar construction projects completed in the last 5 years (since 01-Apr-2020) of value ≥ ₹2 Crore each.",
    mandatory: true,
    expectedFormat: "Count of qualifying projects — extracted from work orders & completion certificates",
    evidenceHints: [
      "Work order issued by client department",
      "Completion certificate signed by Engineer-in-Charge",
    ],
  },
  {
    id: "c3",
    code: "CMP-01",
    type: "compliance" as const,
    title: "Valid GST registration",
    requirement: "Active GST registration as on bid submission date.",
    mandatory: true,
    expectedFormat: "15-digit GSTIN with active status",
    evidenceHints: [
      "GST registration certificate (REG-06)",
      "Latest GSTR-3B acknowledgement (recommended)",
    ],
  },
  {
    id: "c4",
    code: "CMP-02",
    type: "compliance" as const,
    title: "ISO 9001 certification",
    requirement:
      "Valid ISO 9001:2015 (Quality Management Systems) certification covering construction services scope.",
    mandatory: true,
    expectedFormat: "Certificate with valid expiry date and accredited certification body",
    evidenceHints: [
      "ISO 9001:2015 certificate from IAF/NABCB-accredited body",
      "Scope of certification must include construction",
    ],
  },
] as const

// ---------------------------------------------------------------------------
// Bidders — 6 eligible · 3 ineligible · 1 manual review
// ---------------------------------------------------------------------------

type BMini = {
  name: string
  city: string
  reg: string
  contact: string
  email: string
  phone: string
  submittedAt: string
}

const bidderProfiles: BMini[] = [
  { name: "Larsen Construction Pvt Ltd", city: "Mumbai, MH", reg: "U45200MH2008PTC012345", contact: "Rajesh Iyer", email: "rajesh.iyer@pki.in", phone: "+91 98200 12345", submittedAt: "2026-04-22T11:14:00+05:30" },
  { name: "Shapoorji Engineering Works", city: "Pune, MH", reg: "U45201MH2010PTC034521", contact: "Aditi Deshmukh", email: "bids@shapoorji-ew.in", phone: "+91 98230 11122", submittedAt: "2026-04-23T09:42:00+05:30" },
  { name: "Bharat Infra Builders", city: "New Delhi, DL", reg: "U45202DL2009PTC065432", contact: "Vikram Malhotra", email: "vikram@bharatinfra.co.in", phone: "+91 98109 88776", submittedAt: "2026-04-23T16:08:00+05:30" },
  { name: "GMR Civil Solutions", city: "Hyderabad, TG", reg: "U45203TG2012PTC076543", contact: "Sridhar Rao", email: "tenders@gmrcs.in", phone: "+91 99490 22113", submittedAt: "2026-04-24T10:21:00+05:30" },
  { name: "Patel Construction Co.", city: "Ahmedabad, GJ", reg: "U45204GJ2007PTC087654", contact: "Nirav Patel", email: "nirav@patelconstruct.in", phone: "+91 98250 33445", submittedAt: "2026-04-24T13:55:00+05:30" },
  { name: "NCC Urban Projects", city: "Bengaluru, KA", reg: "U45205KA2011PTC098765", contact: "Anitha R.", email: "anitha@nccurban.com", phone: "+91 98860 55667", submittedAt: "2026-04-25T08:30:00+05:30" },
  { name: "Eastern Concrete Industries", city: "Kolkata, WB", reg: "U45206WB2013PTC112233", contact: "Suvankar Banerjee", email: "tenders@easternconcrete.in", phone: "+91 98300 78899", submittedAt: "2026-04-25T12:11:00+05:30" },
  { name: "Rajasthan Heavy Builders", city: "Jaipur, RJ", reg: "U45207RJ2014PTC123344", contact: "Mahendra Singh", email: "office@rajheavy.in", phone: "+91 94140 11223", submittedAt: "2026-04-26T15:48:00+05:30" },
  { name: "Vindhya Construction LLP", city: "Bhopal, MP", reg: "AAH-1234-MP-2015", contact: "Pradeep Tiwari", email: "tenders@vindhyallp.in", phone: "+91 98260 99887", submittedAt: "2026-04-26T17:22:00+05:30" },
  { name: "Coastline Engineering Ltd", city: "Chennai, TN", reg: "L45208TN2006PLC145566", contact: "Karthik Subramanian", email: "tender.team@coastlineeng.com", phone: "+91 98400 22334", submittedAt: "2026-04-27T10:05:00+05:30" },
]

// Outcome plan:
// 0,1,3,5,6,9 → eligible (6)
// 2,4,7      → ineligible
// 8          → manual review (turnover scan unreadable)

type EvalRecipe = { overall: "eligible" | "ineligible" | "manual_review"; evals: Omit<CriterionEvaluation, "documentId" | "pageReference">[] }

const recipes: EvalRecipe[] = [
  // 0 — Larsen — eligible (strong)
  {
    overall: "eligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 18.6 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.97, rationale: "Audited balance sheet (PwC) shows revenue from operations of ₹ 18.62 Cr for FY 2023-24. CA certificate UDIN verified." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "7 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.94, rationale: "7 work orders + completion certificates parsed; values range from ₹ 2.4 Cr to ₹ 11 Cr; all completed between 2021-2025." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "27AAACL1234M1Z5 — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST REG-06 dated 04-Jul-2017; status 'Active' confirmed; latest GSTR-3B filed Mar-2026." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 14-Aug-2027", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.96, rationale: "Certificate by TÜV SÜD South Asia (NABCB-accredited). Scope explicitly includes 'design and construction of civil works'." },
    ],
  },
  // 1 — Shapoorji — eligible
  {
    overall: "eligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 9.4 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.93, rationale: "CA-attested turnover certificate (UDIN 24123456ABCD) confirms turnover ₹ 9.42 Cr." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "4 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.9, rationale: "4 verifiable completion certificates; smallest qualifying project value ₹ 2.15 Cr (PWD Maharashtra)." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "27AAACS5678N1ZK — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST certificate verified via portal lookup mock; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 02-Feb-2027", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.95, rationale: "Bureau Veritas certificate; construction scope confirmed on page 2." },
    ],
  },
  // 2 — Bharat Infra — INELIGIBLE (turnover too low)
  {
    overall: "ineligible",
    evals: [
      { criterionId: "c1", verdict: "ineligible", extractedValue: "₹ 3.1 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.95, rationale: "Audited P&L shows highest annual turnover across last 3 FYs is ₹ 3.10 Cr. Threshold is ₹ 5 Cr — falls short by ₹ 1.90 Cr." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "3 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.88, rationale: "3 completion certificates verified; values ₹ 2.1 Cr, ₹ 2.6 Cr, ₹ 4.0 Cr." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "07AAACB9876P1ZN — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST certificate verified; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 18-Nov-2026", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.94, rationale: "Intertek certificate, construction scope confirmed." },
    ],
  },
  // 3 — GMR Civil — eligible
  {
    overall: "eligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 22.7 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.97, rationale: "Audited balance sheet (Deloitte) — turnover ₹ 22.71 Cr." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "9 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.92, rationale: "9 work orders cross-checked with completion certificates; all qualify." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "36AAACG3344Q1ZS — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST certificate verified; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 28-May-2028", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.96, rationale: "DNV-GL certificate, construction & infrastructure scope." },
    ],
  },
  // 4 — Patel — INELIGIBLE (no ISO)
  {
    overall: "ineligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 7.8 Crore (FY 2022-23)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.93, rationale: "CA certificate (UDIN verified) — turnover ₹ 7.85 Cr in FY 2022-23." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "5 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.9, rationale: "5 verifiable completion certificates spanning 2020-2024." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "24AAACP2233R1ZH — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST certificate verified; active." },
      { criterionId: "c4", verdict: "ineligible", extractedValue: "ISO 14001:2015 (Environmental)", expectedValue: "ISO 9001:2015 (Quality)", confidence: 0.91, rationale: "Submitted certificate is ISO 14001 (Environmental Management), not ISO 9001 (Quality). No ISO 9001 certificate found across uploaded documents." },
    ],
  },
  // 5 — NCC Urban — eligible
  {
    overall: "eligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 14.2 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.96, rationale: "Audited statements (KPMG) show turnover ₹ 14.21 Cr." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "6 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.93, rationale: "6 completion certificates from BBMP, BMRCL and BWSSB verified." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "29AAACN8899S1Z2 — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST REG-06 dated 17-Mar-2018; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 11-Jan-2027", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.95, rationale: "TÜV NORD certificate; scope includes 'building & infrastructure construction'." },
    ],
  },
  // 6 — Eastern Concrete — eligible
  {
    overall: "eligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 6.3 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.92, rationale: "CA-attested turnover certificate verified; turnover ₹ 6.31 Cr." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "3 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.86, rationale: "3 completion certificates from PWD West Bengal and HRBC; smallest qualifying project ₹ 2.05 Cr — narrow margin, verified manually." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "19AAACE4455T1ZP — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST certificate verified; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 04-Sep-2026", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.94, rationale: "BSI Group certificate; construction scope confirmed." },
    ],
  },
  // 7 — Rajasthan Heavy — INELIGIBLE (insufficient projects)
  {
    overall: "ineligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 8.9 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.94, rationale: "Audited balance sheet — turnover ₹ 8.92 Cr." },
      { criterionId: "c2", verdict: "ineligible", extractedValue: "1 qualifying project", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.89, rationale: "Only 1 completion certificate ≥ ₹ 2 Cr (₹ 3.4 Cr, PWD Rajasthan, 2023). Other 4 work orders are below ₹ 2 Cr threshold or are still in progress." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "08AAACR7766U1ZL — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST certificate verified; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 22-Jun-2026", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.93, rationale: "Lloyd's Register certificate; construction scope present." },
    ],
  },
  // 8 — Vindhya — MANUAL REVIEW (turnover unreadable scan)
  {
    overall: "manual_review",
    evals: [
      { criterionId: "c1", verdict: "manual_review", extractedValue: "₹ 5.?? Crore (low confidence)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.42, rationale: "Turnover figure read from low-resolution scanned CA certificate is borderline. OCR confidence 42% — could be ₹ 5.2 Cr or ₹ 3.2 Cr.", reviewReason: "Scanned CA certificate is a low-resolution photograph; the crore figure on page 1 line 14 is partially obscured by a stamp. OCR cannot disambiguate '5' vs '3'." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "4 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.87, rationale: "4 completion certificates verified from MP PWD and Bhopal Smart City Ltd." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "23AAACV6677V1ZJ — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.98, rationale: "GST certificate verified; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 09-Dec-2026", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.93, rationale: "TÜV Rheinland certificate; construction scope present." },
    ],
  },
  // 9 — Coastline — eligible
  {
    overall: "eligible",
    evals: [
      { criterionId: "c1", verdict: "eligible", extractedValue: "₹ 31.5 Crore (FY 2023-24)", expectedValue: "≥ ₹ 5 Crore", confidence: 0.98, rationale: "Audited statements (EY) — turnover ₹ 31.54 Cr." },
      { criterionId: "c2", verdict: "eligible", extractedValue: "11 qualifying projects", expectedValue: "≥ 3 projects ≥ ₹ 2 Cr", confidence: 0.95, rationale: "11 completion certificates verified — TN PWD, CMRL, GCC; values up to ₹ 18 Cr." },
      { criterionId: "c3", verdict: "eligible", extractedValue: "33AAACC8800W1ZM — Active", expectedValue: "Active 15-digit GSTIN", confidence: 0.99, rationale: "GST REG-06 dated 21-Sep-2014; active." },
      { criterionId: "c4", verdict: "eligible", extractedValue: "ISO 9001:2015 — valid till 30-Mar-2028", expectedValue: "Valid ISO 9001:2015 covering construction", confidence: 0.97, rationale: "TÜV SÜD certificate; scope explicitly includes coastal & marine civil construction." },
    ],
  },
]

const docTemplate = (idx: number, recipe: EvalRecipe): { docs: Bidder["documents"]; evals: CriterionEvaluation[] } => {
  const baseDocs: Bidder["documents"] = [
    {
      id: `b${idx}-d1`,
      name: "Audited Financial Statements FY 2023-24.pdf",
      kind: "audited_balance_sheet",
      pages: 38,
      format: idx === 8 ? "Photograph" : "PDF",
      ocrConfidence: idx === 8 ? 0.42 : 0.98,
      uploadedAt: "2026-04-22T10:14:00+05:30",
    },
    {
      id: `b${idx}-d2`,
      name: "CA Turnover Certificate.pdf",
      kind: "ca_certificate",
      pages: 2,
      format: idx === 8 ? "Photograph" : "PDF",
      ocrConfidence: idx === 8 ? 0.42 : 0.96,
      uploadedAt: "2026-04-22T10:15:00+05:30",
    },
    {
      id: `b${idx}-d3`,
      name: "Completion Certificates (bundle).pdf",
      kind: "completion_certificate",
      pages: 24,
      format: "Scanned PDF",
      ocrConfidence: 0.91,
      uploadedAt: "2026-04-22T10:18:00+05:30",
    },
    {
      id: `b${idx}-d4`,
      name: "Work Orders (bundle).pdf",
      kind: "work_order",
      pages: 18,
      format: "PDF",
      ocrConfidence: 0.95,
      uploadedAt: "2026-04-22T10:19:00+05:30",
    },
    {
      id: `b${idx}-d5`,
      name: "GST Registration REG-06.pdf",
      kind: "gst_certificate",
      pages: 1,
      format: "PDF",
      ocrConfidence: 0.99,
      uploadedAt: "2026-04-22T10:20:00+05:30",
    },
    {
      id: `b${idx}-d6`,
      name: idx === 4 ? "ISO 14001-2015 Certificate.pdf" : "ISO 9001-2015 Certificate.pdf",
      kind: "iso_certificate",
      pages: 2,
      format: "PDF",
      ocrConfidence: 0.97,
      uploadedAt: "2026-04-22T10:22:00+05:30",
    },
    {
      id: `b${idx}-d7`,
      name: "PAN Card.pdf",
      kind: "pan",
      pages: 1,
      format: "PDF",
      ocrConfidence: 0.99,
      uploadedAt: "2026-04-22T10:23:00+05:30",
    },
    {
      id: `b${idx}-d8`,
      name: "Bid Form (signed).pdf",
      kind: "bid_form",
      pages: 14,
      format: "PDF",
      ocrConfidence: 0.99,
      uploadedAt: "2026-04-22T10:24:00+05:30",
    },
  ]

  const docByCriterion: Record<string, { docId: string; page: string }> = {
    c1: { docId: `b${idx}-d2`, page: "Page 1, Line 14" },
    c2: { docId: `b${idx}-d3`, page: "Pages 4-22 (multiple certificates)" },
    c3: { docId: `b${idx}-d5`, page: "Page 1" },
    c4: { docId: `b${idx}-d6`, page: "Page 1, Scope clause" },
  }

  const evals: CriterionEvaluation[] = recipe.evals.map((e) => ({
    ...e,
    documentId: docByCriterion[e.criterionId].docId,
    pageReference: docByCriterion[e.criterionId].page,
  }))

  return { docs: baseDocs, evals }
}

const bidders: Bidder[] = bidderProfiles.map((p, i) => {
  const recipe = recipes[i]
  const { docs, evals } = docTemplate(i, recipe)
  const score = Math.round((evals.reduce((a, b) => a + b.confidence, 0) / evals.length) * 100)
  return {
    id: `bidder-${i + 1}`,
    name: p.name,
    city: p.city,
    registrationNo: p.reg,
    contactPerson: p.contact,
    email: p.email,
    phone: p.phone,
    submittedAt: p.submittedAt,
    documents: docs,
    evaluations: evals,
    overall: recipe.overall,
    score,
  }
})

// ---------------------------------------------------------------------------
// Tenders
// ---------------------------------------------------------------------------

export const sampleTender: Tender = {
  id: "tender-001",
  reference: "ORG/PROC/CIV/2026/0142",
  title: "Construction of Group Centre — Boundary Wall, Barracks (Phase-II) & Allied Works",
  category: "Civil Construction",
  issuingDept: "Procurement Wing — Directorate General",
  estimatedValue: "₹ 12.40 Crore",
  publishedOn: "2026-03-28",
  closingOn: "2026-04-27",
  evaluationStartedOn: "2026-04-28",
  status: "under_evaluation",
  description:
    "Construction of perimeter security wall (2.4 km), four 3-storey barrack blocks (Phase-II), guard posts, and allied internal road & drainage works. Bidders must comply with all four mandatory eligibility criteria below for technical qualification.",
  criteria: criteria as unknown as Tender["criteria"],
  bidders,
}

// A second open tender for the bidder portal (not yet under evaluation)
export const openTender: Tender = {
  id: "tender-002",
  reference: "ORG/PROC/COMM/2026/0188",
  title: "Annual Maintenance Contract — Communication Towers (Northern Sector)",
  category: "Maintenance Services",
  issuingDept: "Communications Wing — Northern Sector HQ",
  estimatedValue: "₹ 3.85 Crore",
  publishedOn: "2026-04-15",
  closingOn: "2026-05-20",
  evaluationStartedOn: "",
  status: "open",
  description:
    "Comprehensive AMC for 142 communication towers across Northern Sector — preventive maintenance, emergency repairs, and quarterly audits. Bidder must hold valid telecom licence and ISO 27001 certification.",
  criteria: [
    {
      id: "c1",
      code: "FIN-01",
      type: "financial",
      title: "Minimum annual turnover",
      requirement: "Average annual turnover ≥ ₹ 2 Crore in last 3 financial years.",
      mandatory: true,
      expectedFormat: "₹ value (Crore)",
      evidenceHints: ["Audited balance sheet"],
    },
    {
      id: "c2",
      code: "TEC-01",
      type: "technical",
      title: "Tower maintenance experience",
      requirement: "≥ 50 tower sites maintained under at least one prior contract.",
      mandatory: true,
      expectedFormat: "Count of tower sites",
      evidenceHints: ["Client work order"],
    },
    {
      id: "c3",
      code: "CMP-01",
      type: "compliance",
      title: "Telecom licence",
      requirement: "Valid IP-1 / Infrastructure Provider licence from DoT.",
      mandatory: true,
      expectedFormat: "DoT licence reference",
      evidenceHints: ["DoT licence certificate"],
    },
    {
      id: "c4",
      code: "CMP-02",
      type: "compliance",
      title: "ISO 27001 certification",
      requirement: "Valid ISO 27001:2022 certificate.",
      mandatory: true,
      expectedFormat: "Certificate validity",
      evidenceHints: ["ISO 27001 certificate"],
    },
  ],
  bidders: [],
}

export const closedTender: Tender = {
  id: "tender-003",
  reference: "ORG/PROC/MED/2025/0098",
  title: "Supply of Medical Equipment — Composite Hospital, Guwahati",
  category: "Medical Supplies",
  issuingDept: "Medical Directorate",
  estimatedValue: "₹ 1.92 Crore",
  publishedOn: "2025-11-10",
  closingOn: "2025-12-15",
  evaluationStartedOn: "2025-12-16",
  status: "awarded",
  description: "Supply, installation and commissioning of 47 line items of medical equipment.",
  criteria: [],
  bidders: [],
}

export const tenders: Tender[] = [sampleTender, openTender, closedTender]

export function getTender(id: string): Tender | undefined {
  return tenders.find((t) => t.id === id)
}

export function getBidder(tenderId: string, bidderId: string) {
  const t = getTender(tenderId)
  return t?.bidders.find((b) => b.id === bidderId)
}

// ---------------------------------------------------------------------------
// Audit log (sample, for the under-evaluation tender)
// ---------------------------------------------------------------------------

export const auditEvents: AuditEvent[] = [
  { id: "a1", timestamp: "2026-04-28T09:00:00+05:30", actor: "System", actorRole: "system", action: "Tender locked for evaluation", target: "ORG/PROC/CIV/2026/0142" },
  { id: "a2", timestamp: "2026-04-28T09:01:14+05:30", actor: "System", actorRole: "system", action: "Eligibility criteria extracted from tender document", target: "4 criteria identified", detail: "FIN-01, TEC-01, CMP-01, CMP-02 — all mandatory" },
  { id: "a3", timestamp: "2026-04-28T09:08:42+05:30", actor: "System", actorRole: "system", action: "Document parsing started", target: "10 bidders, 80 documents" },
  { id: "a4", timestamp: "2026-04-28T09:34:19+05:30", actor: "System", actorRole: "system", action: "OCR completed on 12 scanned/photograph documents", target: "Average confidence 0.91" },
  { id: "a5", timestamp: "2026-04-28T09:51:08+05:30", actor: "System", actorRole: "system", action: "Evaluation completed", target: "6 eligible · 3 ineligible · 1 manual review" },
  { id: "a6", timestamp: "2026-04-28T10:02:33+05:30", actor: "Insp. Pooja Shetty", actorRole: "officer", action: "Opened bidder file", target: "Vindhya Construction LLP", detail: "Manual review queue" },
  { id: "a7", timestamp: "2026-04-28T10:14:55+05:30", actor: "Insp. Pooja Shetty", actorRole: "officer", action: "Requested re-upload of CA certificate", target: "Vindhya Construction LLP", detail: "Reason: scanned image illegible — turnover figure ambiguous" },
  { id: "a8", timestamp: "2026-04-28T10:22:01+05:30", actor: "Insp. Pooja Shetty", actorRole: "officer", action: "Confirmed verdict", target: "Bharat Infra Builders — Ineligible", detail: "Reviewed FIN-01 evidence; turnover ₹ 3.10 Cr falls short of ₹ 5 Cr threshold" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function verdictCounts(t: Tender) {
  const acc = { eligible: 0, ineligible: 0, manual_review: 0 }
  for (const b of t.bidders) acc[b.overall]++
  return acc
}

export const officer = {
  name: "Meera Kapoor",
  designation: "Procurement Officer",
  unit: "Directorate General HQ",
  email: "meera.kapoor@organization.gov",
  empId: "PRC-2017-441",
}

export const bidder = {
  name: "PKI Industries Pvt Ltd",
  contact: "Rajesh Iyer",
  designation: "Tender Manager",
  registrationNo: "U45200MH2008PTC012345",
  gstin: "27AAACL1234M1Z5",
  email: "rajesh.iyer@pki.in"
}

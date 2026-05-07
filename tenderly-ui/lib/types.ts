export type Verdict = "eligible" | "ineligible" | "manual_review"

export type CriterionType = "financial" | "technical" | "compliance" | "documentation"

export type Criterion = {
  id: string
  code: string
  type: CriterionType
  title: string
  requirement: string
  mandatory: boolean
  expectedFormat: string
  evidenceHints: string[]
}

export type DocumentKind =
  | "audited_balance_sheet"
  | "ca_certificate"
  | "experience_certificate"
  | "work_order"
  | "completion_certificate"
  | "gst_certificate"
  | "iso_certificate"
  | "pan"
  | "msme"
  | "bid_form"
  | "epf_registration"

export type BidderDocument = {
  id: string
  name: string
  kind: DocumentKind
  pages: number
  format: "PDF" | "Scanned PDF" | "Photograph" | "DOCX"
  ocrConfidence?: number
  uploadedAt: string
}

export type CriterionEvaluation = {
  criterionId: string
  verdict: Verdict
  extractedValue: string
  expectedValue: string
  confidence: number
  documentId: string
  pageReference: string
  rationale: string
  reviewReason?: string
}

export type Bidder = {
  id: string
  name: string
  city: string
  registrationNo: string
  contactPerson: string
  email: string
  phone: string
  submittedAt: string
  documents: BidderDocument[]
  evaluations: CriterionEvaluation[]
  overall: Verdict
  score: number
}

export type Tender = {
  id: string
  reference: string
  title: string
  category: string
  issuingDept: string
  estimatedValue: string
  publishedOn: string
  closingOn: string
  evaluationStartedOn: string
  status: "open" | "under_evaluation" | "evaluated" | "awarded"
  description: string
  criteria: Criterion[]
  bidders: Bidder[]
}

export type AuditEvent = {
  id: string
  timestamp: string
  actor: string
  actorRole: "system" | "officer" | "bidder"
  action: string
  target: string
  detail?: string
}

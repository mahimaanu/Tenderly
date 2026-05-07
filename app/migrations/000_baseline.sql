-- 000_baseline.sql — full core schema (run before any ALTER-based migrations)
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS / DO blocks for types).

-- ─── Custom ENUM types (research/analytics module) ────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.candidate_type_enum AS ENUM ('catalyst', 'enzyme', 'pathway');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.direction_enum AS ENUM ('catalysis', 'synbio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.source_enum AS ENUM (
    'materials_project', 'ocp', 'brenda', 'kegg', 'ai_generated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.triggered_by_enum AS ENUM ('manual', 'auto_threshold', 'scheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Officers / admin users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID         DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  DEFAULT 'officer',
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    password_hash   TEXT,
    designation     TEXT,
    unit            TEXT,
    emp_id          TEXT
);

-- ─── Procurement tenders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenders (
    id                      UUID         DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_number           VARCHAR(100) NOT NULL UNIQUE,
    title                   TEXT         NOT NULL,
    description             TEXT,
    issuing_authority       VARCHAR(200),
    submission_deadline     TIMESTAMP,
    status                  VARCHAR(50)  DEFAULT 'draft',
    created_by              UUID         REFERENCES public.users(id),
    created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    reference               TEXT,
    category                TEXT,
    estimated_value         TEXT,
    published_on            DATE,
    closing_on              DATE,
    evaluation_started_on   TIMESTAMP,
    issuing_dept            TEXT,
    emd_amount              NUMERIC
);

-- ─── Bidder companies registered against tenders ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.bidders (
    id                  UUID         DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_id           UUID         REFERENCES public.tenders(id) ON DELETE CASCADE,
    company_name        VARCHAR(300) NOT NULL,
    contact_email       VARCHAR(255),
    registration_number VARCHAR(100),
    submitted_at        TIMESTAMP,
    status              VARCHAR(50)  DEFAULT 'submitted',
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    city                TEXT,
    phone               TEXT,
    contact_person      TEXT,
    bidder_user_id      UUID
);
CREATE INDEX IF NOT EXISTS idx_bidders_tender ON public.bidders(tender_id);

-- ─── Documents uploaded by bidders ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bidder_documents (
    id               UUID           DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    bidder_id        UUID           REFERENCES public.bidders(id) ON DELETE CASCADE,
    document_type    VARCHAR(100),
    filename         VARCHAR(255)   NOT NULL,
    file_path        TEXT           NOT NULL,
    file_hash        VARCHAR(64),
    extracted_text   TEXT,
    confidence_score NUMERIC(3,2),
    needs_review     BOOLEAN        DEFAULT FALSE,
    page_count       INTEGER,
    processed_at     TIMESTAMP,
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    format           TEXT,
    kind             TEXT,
    uploaded_by      UUID,
    processed        BOOLEAN        DEFAULT FALSE
);

-- ─── Criteria extracted from tender RFPs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.criteria (
    id                  UUID         DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_id           UUID         REFERENCES public.tenders(id) ON DELETE CASCADE,
    criterion_code      VARCHAR(50),
    type                VARCHAR(50)  NOT NULL,
    priority            VARCHAR(20)  NOT NULL,
    description         TEXT         NOT NULL,
    original_text       TEXT,
    threshold_value     VARCHAR(100),
    threshold_operator  VARCHAR(10),
    unit                VARCHAR(50),
    source_page         INTEGER,
    confidence          NUMERIC(3,2),
    manually_verified   BOOLEAN      DEFAULT FALSE,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_criteria_tender ON public.criteria(tender_id);

-- ─── Evaluation summary per bidder per tender ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluations (
    id                    UUID        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_id             UUID        REFERENCES public.tenders(id),
    bidder_id             UUID        REFERENCES public.bidders(id),
    overall_verdict       VARCHAR(50) NOT NULL,
    score                 NUMERIC(5,2),
    total_criteria        INTEGER,
    passed_criteria       INTEGER,
    failed_criteria       INTEGER,
    review_criteria       INTEGER,
    requires_manual_review BOOLEAN    DEFAULT FALSE,
    review_completed      BOOLEAN     DEFAULT FALSE,
    final_verdict         VARCHAR(50),
    evaluated_at          TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tender_id, bidder_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluations_tender ON public.evaluations(tender_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_bidder ON public.evaluations(bidder_id);

-- ─── Per-criterion verdict for each bidder evaluation ─────────────────────────
CREATE TABLE IF NOT EXISTS public.criterion_evaluations (
    id                 UUID        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    evaluation_id      UUID        REFERENCES public.evaluations(id) ON DELETE CASCADE,
    criterion_id       UUID        REFERENCES public.criteria(id),
    verdict            VARCHAR(50) NOT NULL,
    confidence         NUMERIC(3,2),
    requirement        TEXT,
    bidder_value       TEXT,
    comparison_detail  TEXT,
    source_document_id UUID        REFERENCES public.bidder_documents(id),
    source_page        INTEGER,
    source_excerpt     TEXT,
    reasoning          TEXT        NOT NULL,
    review_reason      TEXT,
    manually_reviewed  BOOLEAN     DEFAULT FALSE,
    manual_verdict     VARCHAR(50),
    reviewer_notes     TEXT,
    reviewed_by        UUID        REFERENCES public.users(id),
    reviewed_at        TIMESTAMP,
    created_at         TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    verified           BOOLEAN     DEFAULT FALSE,
    verified_by        UUID,
    verified_at        TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_criterion_evals_evaluation ON public.criterion_evaluations(evaluation_id);

-- ─── Aggregate matrix view of evaluation results per tender ───────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_matrix (
    id                   UUID      DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_id            UUID      UNIQUE REFERENCES public.tenders(id),
    total_bidders        INTEGER,
    eligible_count       INTEGER,
    ineligible_count     INTEGER,
    review_count         INTEGER,
    rankings             JSONB,
    all_reviews_complete BOOLEAN   DEFAULT FALSE,
    generated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Tender RFP documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tender_documents (
    id             UUID         DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_id      UUID         REFERENCES public.tenders(id) ON DELETE CASCADE,
    filename       VARCHAR(255) NOT NULL,
    file_path      TEXT         NOT NULL,
    file_hash      VARCHAR(64),
    extracted_text TEXT,
    page_count     INTEGER,
    processed      BOOLEAN      DEFAULT FALSE,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─── Generated PDF reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
    id           UUID        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tender_id    UUID        REFERENCES public.tenders(id),
    bidder_id    UUID        REFERENCES public.bidders(id),
    report_type  VARCHAR(50),
    file_path    TEXT        NOT NULL,
    generated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ─── Threaded annotations on any entity ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.annotations (
    id          UUID  NOT NULL PRIMARY KEY,
    target_id   UUID,
    target_type TEXT,
    author_id   UUID,
    body        TEXT,
    parent_id   UUID  REFERENCES public.annotations(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Simple audit log (non-chained; see migration 003 for hash-chained log) ───
CREATE TABLE IF NOT EXISTS public.audit_log (
    id            UUID        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    entity_type   VARCHAR(50),
    entity_id     UUID,
    action        VARCHAR(50),
    old_value     JSONB,
    new_value     JSONB,
    performed_by  UUID        REFERENCES public.users(id),
    notes         TEXT,
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log(entity_type, entity_id);

-- ─── Research / analytics module ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reactions (
    id              UUID     NOT NULL PRIMARY KEY,
    name            TEXT     NOT NULL,
    smiles_reactants VARCHAR[],
    smiles_products  VARCHAR[],
    direction       public.direction_enum,
    created_by      UUID,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidates (
    id                 UUID                      NOT NULL PRIMARY KEY,
    reaction_id        UUID                      REFERENCES public.reactions(id),
    source             public.source_enum,
    candidate_type     public.candidate_type_enum,
    smiles             TEXT,
    sequence           TEXT,
    structure_file     TEXT,
    candidate_metadata JSON,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.predictions (
    id             UUID   NOT NULL PRIMARY KEY,
    candidate_id   UUID   REFERENCES public.candidates(id),
    model_version  TEXT   NOT NULL,
    activity       DOUBLE PRECISION,
    selectivity    DOUBLE PRECISION,
    stability      DOUBLE PRECISION,
    reaction_yield DOUBLE PRECISION,
    confidence     DOUBLE PRECISION,
    raw_output     JSON,
    predicted_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.experiments (
    id                   UUID  NOT NULL PRIMARY KEY,
    candidate_id         UUID  REFERENCES public.candidates(id),
    researcher_id        UUID,
    measured_yield       DOUBLE PRECISION,
    measured_selectivity DOUBLE PRECISION,
    measured_activity    DOUBLE PRECISION,
    notes                TEXT,
    attachments          VARCHAR[],
    experiment_date      TIMESTAMP WITH TIME ZONE,
    logged_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.model_runs (
    id                  UUID  NOT NULL PRIMARY KEY,
    model_type          TEXT  NOT NULL,
    version             TEXT  NOT NULL,
    training_data_count INTEGER,
    val_loss            DOUBLE PRECISION,
    val_r2              DOUBLE PRECISION,
    triggered_by        public.triggered_by_enum,
    trained_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

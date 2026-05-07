-- 003_audit_clarifications_notifications.sql
-- New tables: audit_events (hash-chained), clarifications, notifications,
-- submissions (bidder draft state), evaluation_jobs, user_preferences.

-- Audit chain
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    actor_id UUID,
    actor_role VARCHAR(50) NOT NULL,
    actor_label VARCHAR(255) NOT NULL,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    detail JSONB,
    request_id UUID,
    prev_hash CHAR(64),
    hash CHAR(64) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_role ON audit_events(actor_role);

-- Clarifications (officer ↔ bidder thread tied to a criterion or just to a tender)
CREATE TABLE IF NOT EXISTS clarifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    bidder_id UUID REFERENCES bidders(id) ON DELETE SET NULL,
    bidder_user_id UUID,
    criterion_evaluation_id UUID REFERENCES criterion_evaluations(id) ON DELETE SET NULL,
    initiated_by_role VARCHAR(20) NOT NULL,  -- officer | bidder
    initiated_by UUID,
    subject TEXT NOT NULL,
    body TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | responded | closed
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clarifications_bidder ON clarifications(bidder_id);
CREATE INDEX IF NOT EXISTS idx_clarifications_bidder_user ON clarifications(bidder_user_id);
CREATE INDEX IF NOT EXISTS idx_clarifications_status ON clarifications(status);

CREATE TABLE IF NOT EXISTS clarification_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clarification_id UUID NOT NULL REFERENCES clarifications(id) ON DELETE CASCADE,
    author_role VARCHAR(20) NOT NULL,
    author_id UUID,
    text TEXT,
    attachment_doc_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_role VARCHAR(20) NOT NULL,         -- officer | bidder
    kind VARCHAR(50) NOT NULL,              -- bid_received | evaluation_done | clarification_request | award_decision | reupload_requested
    title TEXT NOT NULL,
    body TEXT,
    target_url TEXT,
    related_tender_id UUID,
    related_bidder_id UUID,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Bidder-side submission drafts (before being promoted to bidders + bidder_documents)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bidder_user_id UUID NOT NULL REFERENCES bidder_users(id) ON DELETE CASCADE,
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft | signed | submitted | withdrawn
    bid_amount NUMERIC,
    emd_reference TEXT,
    notes TEXT,
    signed_at TIMESTAMP,
    submitted_at TIMESTAMP,
    promoted_bidder_id UUID REFERENCES bidders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (bidder_user_id, tender_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(bidder_user_id);

CREATE TABLE IF NOT EXISTS submission_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    filename VARCHAR(300) NOT NULL,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64),
    kind VARCHAR(80),
    format VARCHAR(40),
    page_count INTEGER,
    extracted_text TEXT,
    confidence_score NUMERIC,
    needs_review BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_submission_docs_sub ON submission_documents(submission_id);

-- Async evaluation jobs (status surface for SSE / polling)
CREATE TABLE IF NOT EXISTS evaluation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    progress_percent INTEGER DEFAULT 0,
    progress_stage VARCHAR(80),
    error JSONB,
    requested_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eval_jobs_tender ON evaluation_jobs(tender_id);
CREATE INDEX IF NOT EXISTS idx_eval_jobs_status ON evaluation_jobs(status);

-- User preferences (officer & bidder)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY,
    user_role VARCHAR(20) NOT NULL,
    confidence_floor NUMERIC DEFAULT 0.75,
    ocr_floor NUMERIC DEFAULT 0.70,
    notifications JSONB DEFAULT '{}'::jsonb,
    pre_bid_hints BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT NOW()
);

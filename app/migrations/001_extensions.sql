-- 001_extensions.sql — extend existing tables to match the UI fields
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE tenders
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value TEXT,
  ADD COLUMN IF NOT EXISTS published_on DATE,
  ADD COLUMN IF NOT EXISTS closing_on DATE,
  ADD COLUMN IF NOT EXISTS evaluation_started_on TIMESTAMP,
  ADD COLUMN IF NOT EXISTS issuing_dept TEXT,
  ADD COLUMN IF NOT EXISTS emd_amount NUMERIC;

-- Backfill: use tender_number as reference where missing
UPDATE tenders SET reference = tender_number WHERE reference IS NULL;

ALTER TABLE bidders
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS bidder_user_id UUID;

ALTER TABLE bidder_documents
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

ALTER TABLE criterion_evaluations
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- Officer users: add password_hash for basic JWT auth
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS emp_id TEXT;

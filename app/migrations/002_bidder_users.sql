-- 002_bidder_users.sql — self-serve bidder accounts (separate from officer users)

CREATE TABLE IF NOT EXISTS bidder_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_name VARCHAR(300) NOT NULL,
    registration_number VARCHAR(100),
    gstin VARCHAR(20),
    contact_person VARCHAR(255),
    designation VARCHAR(255),
    phone VARCHAR(40),
    city VARCHAR(120),
    address TEXT,
    kyc_verified BOOLEAN DEFAULT FALSE,
    capability JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bidder_users_email ON bidder_users(email);

-- Bidder certifications
CREATE TABLE IF NOT EXISTS bidder_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bidder_user_id UUID NOT NULL REFERENCES bidder_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issuing_body VARCHAR(255),
    certificate_number VARCHAR(120),
    issued_on DATE,
    expires_on DATE,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bidder_certs_user ON bidder_certifications(bidder_user_id);

-- Authorised signatories
CREATE TABLE IF NOT EXISTS bidder_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bidder_user_id UUID NOT NULL REFERENCES bidder_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(255),
    role VARCHAR(50) DEFAULT 'backup',  -- primary | backup
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- BrandGate Database Schema & Seed Data (Supabase PostgreSQL)
-- Phase 1 Foundation
-- ==============================================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Brands Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Vault Items Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vault_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('fact', 'rule', 'terminology', 'palette')),
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_brand_vault_item UNIQUE (brand_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_items_brand_item ON vault_items(brand_id, item_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_kind ON vault_items(kind);

-- ------------------------------------------------------------------------------
-- 3. Drafts Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body_text TEXT NOT NULL,
    image_url TEXT,
    alt_text TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'checked', 'pending_approval', 'approved', 'needs_changes')),
    current_version INT NOT NULL DEFAULT 1,
    created_by_role TEXT NOT NULL CHECK (created_by_role IN ('creator', 'reviewer', 'guest')),
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_drafts_brand ON drafts(brand_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

-- ------------------------------------------------------------------------------
-- 4. Draft Versions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draft_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    body_text TEXT NOT NULL,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_draft_version UNIQUE (draft_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_draft_versions_draft ON draft_versions(draft_id);

-- ------------------------------------------------------------------------------
-- 5. Findings Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    lane TEXT NOT NULL CHECK (lane IN ('contradiction', 'evidence_needed', 'human_decision')),
    severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    citation_id TEXT NOT NULL,
    explanation TEXT NOT NULL,
    suggested_fix TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_draft ON findings(draft_id, version_no);
CREATE INDEX IF NOT EXISTS idx_findings_citation ON findings(citation_id);

-- ------------------------------------------------------------------------------
-- 6. Comments Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_draft ON comments(draft_id, version_no);

-- ------------------------------------------------------------------------------
-- 7. Decisions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    role TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approve', 'request_changes', 'request_approval', 'edit', 're_review')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_draft ON decisions(draft_id, version_no);

-- ------------------------------------------------------------------------------
-- 8. Profiles Table (For Phase 5 Auth Integration)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('creator', 'reviewer')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- Seed Data: One Demo Brand ("Demo Brand (Seeded)")
-- Fixed Brand UUID for seamless guest demo queries: 00000000-0000-0000-0000-000000000001
-- ==============================================================================

INSERT INTO brands (id, name, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Brand (Seeded)',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ------------------------------------------------------------------------------
-- Vault Items for Demo Brand
-- ------------------------------------------------------------------------------

-- F-12: Festive cookware offer
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'F-12',
    'fact',
    'Festive Cookware Promotional Price',
    'Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

-- R-04: Rank and performance superlatives rule
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'R-04',
    'rule',
    'Superlatives & Ranking Claims Require Approved Evidence',
    'Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

-- A-02: Approved logo file rule
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'A-02',
    'rule',
    'Approved Current Logo Requirement',
    'Current approved logo file only; archived logo is not accepted.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

-- R-09: Descriptive alt text rule
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'R-09',
    'rule',
    'Mandatory Descriptive Image Alt Text',
    'Every creative requires descriptive alt text.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

-- Terminology Rows (Disallowed & Evidence-Required Terms)
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'T-01',
    'terminology',
    'Restricted Term: clinically proven',
    'Term "clinically proven" is categorized as evidence_required. Cannot be used without an approved clinical trial citation ID.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'T-02',
    'terminology',
    'Restricted Term: India''s No. 1',
    'Term "India''s No. 1" is categorized as evidence_required. Cannot be used without a market research verification citation ID.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

-- Approved Replacement Terms
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'T-03',
    'terminology',
    'Approved Term: certified quality',
    'Term "certified quality" is an approved replacement for unsubstantiated superiority claims.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'T-04',
    'terminology',
    'Approved Term: trusted by millions',
    'Term "trusted by millions" is an approved replacement for unsupported ranking claims.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

-- Palette Rows (Brand Colors)
INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'P-01',
    'palette',
    'Primary Brand Blue',
    '#1E3A8A - Seeded Primary Blue for headers, hero elements, and primary buttons.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'P-02',
    'palette',
    'Secondary Accent Amber',
    '#D97706 - Seeded Secondary Amber for highlight badges and key callouts.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'P-03',
    'palette',
    'Surface Neutral Light',
    '#F8FAFC - Seeded background color for clean, neutral canvas.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

INSERT INTO vault_items (brand_id, item_id, kind, title, text, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'P-04',
    'palette',
    'Text Slate Dark',
    '#0F172A - Seeded high-contrast text color.',
    'active'
)
ON CONFLICT (brand_id, item_id) DO UPDATE SET
    title = EXCLUDED.title,
    text = EXCLUDED.text,
    status = EXCLUDED.status;

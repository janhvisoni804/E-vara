-- E-VARA IDENTITY DEFENSE OS
-- DATABASE SCHEMA V3.0 (Industrial Hardened)

-- 1. Identity Monitoring Table
CREATE TABLE monitored_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'username', 'domain')), 
    identity_value_encrypted TEXT NOT NULL, 
    identity_hash CHAR(64) UNIQUE NOT NULL, -- Strictly enforced SHA-256
    full_name TEXT,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    is_active BOOLEAN DEFAULT true,
    last_scanned_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Breach History Table
CREATE TABLE identity_breaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identity_id UUID NOT NULL REFERENCES monitored_identities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    leak_date DATE,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    data_types TEXT[] NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Billing & Operational Tiers
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT DEFAULT 'tactical' CHECK (tier IN ('tactical', 'executive', 'omni')),
    node_id_stable TEXT UNIQUE NOT NULL,
    billing_status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Secure Audit & Events
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ABSOLUTE RLS ENFORCEMENT
ALTER TABLE monitored_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_breaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Shared Policy: Ownership Handshake
CREATE POLICY "Identity_Isolation" ON monitored_identities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Breach_Isolation" ON identity_breaches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Profile_Isolation" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Audit_Isolation" ON security_audit_logs FOR SELECT USING (auth.uid() = user_id);

-- INDEXING FOR SCALE
CREATE INDEX idx_identities_user ON monitored_identities(user_id);
CREATE INDEX idx_breaches_identity ON identity_breaches(identity_id);
CREATE INDEX idx_breaches_user ON identity_breaches(user_id);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    llc_name VARCHAR(200),
    phone1 VARCHAR(20),
    phone2 VARCHAR(20),
    email1 VARCHAR(255),
    email2 VARCHAR(255),
    property_address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    property_county VARCHAR(100),
    property_type VARCHAR(50),
    bedrooms INTEGER,
    total_bathrooms DECIMAL(3,1),
    building_sqft INTEGER,
    effective_year_built INTEGER,
    est_value INTEGER,
    debt_owed INTEGER,
    est_equity INTEGER,
    dnc BOOLEAN DEFAULT FALSE,
    dnc_reason TEXT,
    deal_status VARCHAR(50) DEFAULT 'lead' CHECK (deal_status IN ('lead', 'credit_run', 'document_collection', 'processing', 'underwriting', 'appraisal_fee', 'closing', 'funded', 'lost')),
    notes TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone1 ON contacts(phone1);
CREATE INDEX IF NOT EXISTS idx_contacts_email1 ON contacts(email1);
CREATE INDEX IF NOT EXISTS idx_contacts_deal_status ON contacts(deal_status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_city_state ON contacts(city, state);
CREATE INDEX IF NOT EXISTS idx_contacts_property_type ON contacts(property_type);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

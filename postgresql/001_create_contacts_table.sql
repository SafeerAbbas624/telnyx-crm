-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    llc_name VARCHAR(200),
    phone1 VARCHAR(20),
    phone2 VARCHAR(20),
    phone3 VARCHAR(20),
    email1 VARCHAR(255),
    email2 VARCHAR(255),
    email3 VARCHAR(255),
    property_address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    property_county VARCHAR(100),
    property_type VARCHAR(50),
    bedrooms INTEGER,
    total_bathrooms NUMERIC(4,2),
    building_sqft INTEGER,
    effective_year_built INTEGER,
    est_value NUMERIC(15,2),
    est_equity NUMERIC(15,2),
    dnc BOOLEAN DEFAULT FALSE,
    dnc_reason TEXT,
    deal_status VARCHAR(50) DEFAULT 'lead' CHECK (deal_status IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    notes TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone1 ON contacts(phone1);
CREATE INDEX IF NOT EXISTS idx_contacts_phone2 ON contacts(phone2);
CREATE INDEX IF NOT EXISTS idx_contacts_phone3 ON contacts(phone3);
CREATE INDEX IF NOT EXISTS idx_contacts_email1 ON contacts(email1);
CREATE INDEX IF NOT EXISTS idx_contacts_email2 ON contacts(email2);
CREATE INDEX IF NOT EXISTS idx_contacts_email3 ON contacts(email3);
CREATE INDEX IF NOT EXISTS idx_contacts_deal_status ON contacts(deal_status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_city_state ON contacts(city, state);
CREATE INDEX IF NOT EXISTS idx_contacts_property_type ON contacts(property_type);
CREATE INDEX IF NOT EXISTS idx_contacts_est_value ON contacts(est_value);
CREATE INDEX IF NOT EXISTS idx_contacts_dnc ON contacts(dnc);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE contacts IS 'Main contacts table storing all contact information including property details';
COMMENT ON COLUMN contacts.dnc IS 'Do Not Call flag - true if contact is on do not call list';
COMMENT ON COLUMN contacts.deal_status IS 'Current status of the deal/lead in the sales pipeline';


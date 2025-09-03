-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'contract', 'closing', 'closed_won', 'closed_lost')),
    value NUMERIC(15,2) NOT NULL DEFAULT 0,
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    source VARCHAR(100),
    campaign VARCHAR(100),
    lead_score INTEGER DEFAULT 0,
    assigned_to UUID,
    team_id UUID,
    pipeline VARCHAR(100) DEFAULT 'default',
    lost_reason VARCHAR(500),
    won_reason VARCHAR(500),
    competitor VARCHAR(200),
    next_step TEXT,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for deal queries
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_actual_close_date ON deals(actual_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_value ON deals(value DESC);
CREATE INDEX IF NOT EXISTS idx_deals_probability ON deals(probability);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_team_id ON deals(team_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline);
CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source);
CREATE INDEX IF NOT EXISTS idx_deals_lead_score ON deals(lead_score DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_deals_updated_at 
    BEFORE UPDATE ON deals
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key to activities table
ALTER TABLE activities ADD CONSTRAINT fk_activities_deal_id 
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

-- Add comments
COMMENT ON TABLE deals IS 'Sales opportunities and deals associated with contacts';
COMMENT ON COLUMN deals.lead_score IS 'Calculated lead score based on various factors';
COMMENT ON COLUMN deals.custom_fields IS 'JSON object for custom deal fields';

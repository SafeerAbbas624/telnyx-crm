-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_is_system ON tags(is_system);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_tags_updated_at 
    BEFORE UPDATE ON tags
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default system tags
INSERT INTO tags (name, color, description, is_system) VALUES
    ('Hot Lead', '#EF4444', 'High priority lead with strong interest', true),
    ('Cold Lead', '#3B82F6', 'Initial contact, needs nurturing', true),
    ('Qualified', '#10B981', 'Lead has been qualified and meets criteria', true),
    ('Follow Up', '#F59E0B', 'Requires follow-up contact', true),
    ('Not Interested', '#6B7280', 'Contact has expressed no interest', true),
    ('Investor', '#8B5CF6', 'Real estate investor contact', true),
    ('Owner Occupant', '#06B6D4', 'Property owner who lives in the property', true),
    ('Wholesaler', '#F97316', 'Wholesale real estate contact', true),
    ('Agent/Broker', '#EC4899', 'Real estate agent or broker', true),
    ('VIP', '#DC2626', 'Very important contact', true)
ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON TABLE tags IS 'Tags for categorizing contacts and deals';
COMMENT ON COLUMN tags.is_system IS 'True for system-created tags that should not be deleted';

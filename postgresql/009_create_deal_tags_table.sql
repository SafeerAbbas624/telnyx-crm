-- Create deal_tags junction table
CREATE TABLE IF NOT EXISTS deal_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    UNIQUE(deal_id, tag_id)
);

-- Create indexes for deal tags junction table
CREATE INDEX IF NOT EXISTS idx_deal_tags_deal_id ON deal_tags(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_tags_tag_id ON deal_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_deal_tags_created_by ON deal_tags(created_by);

-- Add comments
COMMENT ON TABLE deal_tags IS 'Many-to-many relationship between deals and tags';

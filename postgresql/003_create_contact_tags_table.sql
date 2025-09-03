-- Create contact_tags junction table
CREATE TABLE IF NOT EXISTS contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    UNIQUE(contact_id, tag_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_created_by ON contact_tags(created_by);

-- Add comments
COMMENT ON TABLE contact_tags IS 'Many-to-many relationship between contacts and tags';
COMMENT ON COLUMN contact_tags.created_by IS 'User ID who applied this tag';

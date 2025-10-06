-- Create activity_tags junction table
CREATE TABLE IF NOT EXISTS activity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    UNIQUE(activity_id, tag_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_tags_activity_id ON activity_tags(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_tags_tag_id ON activity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_activity_tags_created_by ON activity_tags(created_by);

-- Add comments
COMMENT ON TABLE activity_tags IS 'Many-to-many relationship between activities and tags';
COMMENT ON COLUMN activity_tags.created_by IS 'User ID who applied this tag';

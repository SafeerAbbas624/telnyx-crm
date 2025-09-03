CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tags
INSERT INTO tags (id, name, color) VALUES
    ('tag1', 'Hot Lead', 'red'),
    ('tag2', 'Cold Lead', 'blue'),
    ('tag3', 'Investor', 'green'),
    ('tag4', 'Owner', 'purple'),
    ('tag5', 'Multi-Family', 'orange'),
    ('tag6', 'Single-Family', 'teal'),
    ('tag7', 'Commercial', 'indigo'),
    ('tag8', 'Follow-up', 'pink'),
    ('tag9', 'New Contact', 'yellow'),
    ('tag10', 'VIP', 'emerald')
ON CONFLICT (name) DO NOTHING;

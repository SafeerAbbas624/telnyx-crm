CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200),
    assistant_id UUID REFERENCES assistants(id) ON DELETE SET NULL,
    squad_id UUID,
    server_url TEXT,
    server_url_secret VARCHAR(500),
    capabilities TEXT[] DEFAULT ARRAY['voice', 'sms'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_assistant_id ON phone_numbers(assistant_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_is_active ON phone_numbers(is_active);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

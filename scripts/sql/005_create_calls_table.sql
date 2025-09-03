CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    duration INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('completed', 'missed', 'failed', 'busy', 'no-answer')),
    type VARCHAR(20) DEFAULT 'outbound' CHECK (type IN ('inbound', 'outbound')),
    notes TEXT,
    call_sid VARCHAR(100),
    recording_url TEXT,
    recording_duration INTEGER,
    from_number VARCHAR(20),
    to_number VARCHAR(20),
    cost DECIMAL(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_type ON calls(type);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

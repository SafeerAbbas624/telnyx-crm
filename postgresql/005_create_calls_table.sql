-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    duration INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL CHECK (status IN ('completed', 'missed', 'voicemail', 'failed', 'busy', 'no-answer', 'cancelled')),
    call_type VARCHAR(20) DEFAULT 'voice' CHECK (call_type IN ('voice', 'conference', 'forwarded')),
    from_number VARCHAR(20),
    to_number VARCHAR(20),
    call_sid VARCHAR(100),
    recording_url TEXT,
    recording_duration INTEGER,
    cost NUMERIC(10,4),
    notes TEXT,
    answered_by VARCHAR(50),
    hangup_cause VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for call queries
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_duration ON calls(duration);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_calls_updated_at 
    BEFORE UPDATE ON calls
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE calls IS 'Phone call records including duration, status, and recordings';
COMMENT ON COLUMN calls.answered_by IS 'Who answered the call (human, machine, etc.)';
COMMENT ON COLUMN calls.hangup_cause IS 'Reason the call ended';

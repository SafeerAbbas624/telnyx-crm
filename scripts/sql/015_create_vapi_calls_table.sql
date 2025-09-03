CREATE TABLE IF NOT EXISTS vapi_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vapi_call_id VARCHAR(200) UNIQUE,
    assistant_id UUID REFERENCES assistants(id) ON DELETE SET NULL,
    assistant_overrides JSONB,
    squad_id UUID,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    name VARCHAR(500),
    type VARCHAR(50) NOT NULL CHECK (type IN ('inboundPhoneCall', 'outboundPhoneCall', 'webCall')),
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'ringing', 'in-progress', 'forwarding', 'ended')),
    ended_reason VARCHAR(100),
    messages JSONB,
    messages_openai_formatted JSONB,
    phone_call_provider VARCHAR(50) DEFAULT 'twilio' CHECK (phone_call_provider IN ('twilio', 'vonage', 'vapi')),
    phone_call_provider_id VARCHAR(200),
    phone_call_transport VARCHAR(20) DEFAULT 'pstn' CHECK (phone_call_transport IN ('sip', 'pstn')),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    cost DECIMAL(10,4),
    cost_breakdown JSONB,
    transcript TEXT,
    recording_url TEXT,
    summary TEXT,
    analysis JSONB,
    stereo_recording_url TEXT,
    mono_recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vapi_calls_vapi_call_id ON vapi_calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_assistant_id ON vapi_calls(assistant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_customer_id ON vapi_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_phone_number_id ON vapi_calls(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_type ON vapi_calls(type);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_status ON vapi_calls(status);
CREATE INDEX IF NOT EXISTS idx_vapi_calls_started_at ON vapi_calls(started_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_vapi_calls_updated_at BEFORE UPDATE ON vapi_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

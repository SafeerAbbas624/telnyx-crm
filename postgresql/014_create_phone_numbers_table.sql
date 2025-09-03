-- Create phone_numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(20) NOT NULL UNIQUE,
    formatted_number VARCHAR(25),
    country_code VARCHAR(5) DEFAULT '+1',
    area_code VARCHAR(5),
    name VARCHAR(200),
    provider VARCHAR(50) DEFAULT 'twilio' CHECK (provider IN ('twilio', 'vonage', 'vapi')),
    provider_account_sid VARCHAR(200),
    provider_phone_number_id VARCHAR(200),
    assistant_id UUID REFERENCES assistants(id) ON DELETE SET NULL,
    squad_id UUID,
    server_url TEXT,
    server_url_secret VARCHAR(500),
    capabilities TEXT[] DEFAULT ARRAY['voice', 'sms'],
    voice_settings JSONB DEFAULT '{}',
    sms_settings JSONB DEFAULT '{}',
    fallback_destination VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    purchase_date DATE,
    monthly_cost NUMERIC(8,2),
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for phone number queries
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_formatted ON phone_numbers(formatted_number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_assistant_id ON phone_numbers(assistant_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_provider ON phone_numbers(provider);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_is_active ON phone_numbers(is_active);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_capabilities ON phone_numbers USING gin(capabilities);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_area_code ON phone_numbers(area_code);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_phone_numbers_updated_at 
    BEFORE UPDATE ON phone_numbers
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE phone_numbers IS 'Phone numbers for voice and SMS communications';
COMMENT ON COLUMN phone_numbers.capabilities IS 'Array of capabilities: voice, sms, mms, fax';
COMMENT ON COLUMN phone_numbers.fallback_destination IS 'Fallback number or SIP address';

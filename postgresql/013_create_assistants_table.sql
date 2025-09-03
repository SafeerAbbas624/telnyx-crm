-- Create assistants table for AI voice assistants
CREATE TABLE IF NOT EXISTS assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    first_message TEXT,
    system_prompt TEXT,
    model_provider VARCHAR(50) DEFAULT 'openai' CHECK (model_provider IN ('openai', 'anthropic', 'together-ai', 'anyscale')),
    model VARCHAR(100) DEFAULT 'gpt-3.5-turbo',
    voice_provider VARCHAR(50) DEFAULT 'playht' CHECK (voice_provider IN ('11labs', 'playht', 'rime-ai', 'neets', 'openai')),
    voice_id VARCHAR(100),
    voice_settings JSONB DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    response_delay_seconds NUMERIC(4,2) DEFAULT 1.0,
    llm_request_delay_seconds NUMERIC(4,2) DEFAULT 0.1,
    interruption_threshold INTEGER DEFAULT 100,
    max_duration_seconds INTEGER DEFAULT 1800,
    silence_timeout_seconds INTEGER DEFAULT 30,
    background_sound VARCHAR(50) DEFAULT 'office',
    backchaneling_enabled BOOLEAN DEFAULT FALSE,
    background_denoising_enabled BOOLEAN DEFAULT TRUE,
    model_output_in_messages_enabled BOOLEAN DEFAULT FALSE,
    transport_configurations JSONB DEFAULT '{}',
    recording_enabled BOOLEAN DEFAULT TRUE,
    video_recording_enabled BOOLEAN DEFAULT FALSE,
    end_call_message TEXT,
    end_call_phrases TEXT[],
    voicemail_detection_enabled BOOLEAN DEFAULT TRUE,
    voicemail_message TEXT,
    analysis_plan JSONB DEFAULT '{}',
    artifact_plan JSONB DEFAULT '{}',
    message_plan JSONB DEFAULT '{}',
    start_speaking_plan JSONB DEFAULT '{}',
    stop_speaking_plan JSONB DEFAULT '{}',
    monitor_plan JSONB DEFAULT '{}',
    credential_ids JSONB DEFAULT '{}',
    server_url TEXT,
    server_url_secret VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    success_rate NUMERIC(5,2) DEFAULT 0.0,
    average_duration INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for assistant queries
CREATE INDEX IF NOT EXISTS idx_assistants_name ON assistants(name);
CREATE INDEX IF NOT EXISTS idx_assistants_model_provider ON assistants(model_provider);
CREATE INDEX IF NOT EXISTS idx_assistants_voice_provider ON assistants(voice_provider);
CREATE INDEX IF NOT EXISTS idx_assistants_is_active ON assistants(is_active);
CREATE INDEX IF NOT EXISTS idx_assistants_language ON assistants(language);
CREATE INDEX IF NOT EXISTS idx_assistants_usage_count ON assistants(usage_count DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_assistants_updated_at 
    BEFORE UPDATE ON assistants
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE assistants IS 'AI voice assistants configuration for VAPI integration';
COMMENT ON COLUMN assistants.interruption_threshold IS 'Threshold for interrupting the assistant';
COMMENT ON COLUMN assistants.success_rate IS 'Percentage of successful calls';

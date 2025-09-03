CREATE TABLE IF NOT EXISTS assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    first_message TEXT,
    system_prompt TEXT,
    model VARCHAR(100) DEFAULT 'gpt-3.5-turbo',
    voice VARCHAR(100) DEFAULT 'jennifer',
    response_delay_seconds INTEGER DEFAULT 1,
    llm_request_delay_seconds INTEGER DEFAULT 0,
    num_words_to_interrupt_assistant INTEGER DEFAULT 2,
    max_duration_seconds INTEGER DEFAULT 1800,
    background_sound VARCHAR(100) DEFAULT 'none',
    backchaneling_enabled BOOLEAN DEFAULT FALSE,
    background_denoising_enabled BOOLEAN DEFAULT TRUE,
    model_output_in_messages_enabled BOOLEAN DEFAULT FALSE,
    transport_configuration_twilio_account_sid VARCHAR(200),
    transport_configuration_twilio_auth_token VARCHAR(200),
    recording_enabled BOOLEAN DEFAULT TRUE,
    video_recording_enabled BOOLEAN DEFAULT FALSE,
    silence_timeout_seconds INTEGER DEFAULT 30,
    response_delay_seconds_min INTEGER DEFAULT 1,
    response_delay_seconds_max INTEGER DEFAULT 3,
    enable_summary BOOLEAN DEFAULT TRUE,
    summary_prompt TEXT,
    summary_request_timeout_seconds INTEGER DEFAULT 10,
    custom_endpointing_enabled BOOLEAN DEFAULT FALSE,
    end_call_message TEXT,
    end_call_phrases TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assistants_name ON assistants(name);
CREATE INDEX IF NOT EXISTS idx_assistants_model ON assistants(model);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_assistants_updated_at BEFORE UPDATE ON assistants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

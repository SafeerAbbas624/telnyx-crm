-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    channel VARCHAR(20) DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp', 'email', 'voice')),
    last_message_id UUID,
    last_message_content TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_direction VARCHAR(10) CHECK (last_message_direction IN ('inbound', 'outbound')),
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    assigned_to UUID,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'spam', 'blocked')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    labels TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone_number ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread_count ON conversations(unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON conversations(is_archived);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_priority ON conversations(priority);
CREATE INDEX IF NOT EXISTS idx_conversations_labels ON conversations USING gin(labels);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint to messages table
ALTER TABLE messages ADD CONSTRAINT fk_messages_conversation_id 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON TABLE conversations IS 'Conversation threads for different communication channels';
COMMENT ON COLUMN conversations.channel IS 'Communication channel (SMS, WhatsApp, email, etc.)';
COMMENT ON COLUMN conversations.labels IS 'Array of labels for conversation categorization';

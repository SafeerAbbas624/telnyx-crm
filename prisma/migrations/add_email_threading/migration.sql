-- Add email threading fields to email_messages table
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS "references" TEXT[] DEFAULT '{}';

-- Create index for thread_id for faster queries
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);

-- Create index for in_reply_to for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_messages_in_reply_to ON email_messages(in_reply_to);


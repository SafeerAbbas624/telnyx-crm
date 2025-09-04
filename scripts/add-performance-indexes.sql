-- Performance Indexes for 500K+ Contacts
-- Run this script on your sms_messaging database

-- Drop existing indexes if they exist (to avoid conflicts)
DROP INDEX IF EXISTS idx_contacts_created_at;
DROP INDEX IF EXISTS idx_contacts_name;
DROP INDEX IF EXISTS idx_contacts_phone1;
DROP INDEX IF EXISTS idx_contacts_email1;
DROP INDEX IF EXISTS idx_contacts_status_created;
DROP INDEX IF EXISTS idx_contacts_location;
DROP INDEX IF EXISTS idx_contacts_property_type;
DROP INDEX IF EXISTS idx_contacts_dnc;

-- Create performance indexes for contacts table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_phone1 ON contacts(phone1);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email1 ON contacts(email1);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_status_created ON contacts(deal_status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_location ON contacts(city, state);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_property_type ON contacts(property_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_dnc ON contacts(dnc);

-- Indexes for conversations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_unread ON conversations(unread_count);

-- Indexes for telnyx_messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_messages_contact_created ON telnyx_messages(contact_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_messages_from ON telnyx_messages(from_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_messages_to ON telnyx_messages(to_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_messages_direction_created ON telnyx_messages(direction, created_at DESC);

-- Indexes for telnyx_calls
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_calls_contact_created ON telnyx_calls(contact_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_calls_from ON telnyx_calls(from_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_calls_to ON telnyx_calls(to_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_calls_direction_created ON telnyx_calls(direction, created_at DESC);

-- Indexes for activities (if the table exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_contact_due ON activities(contact_id, due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_status_due ON activities(status, due_date);

-- Indexes for contact_assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_assignments_user ON contact_assignments(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_assignments_contact ON contact_assignments(contact_id);

-- Full-text search index for contacts (GIN index for fast text search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_search_text ON contacts 
USING gin(to_tsvector('english', 
  COALESCE(first_name, '') || ' ' || 
  COALESCE(last_name, '') || ' ' || 
  COALESCE(llc_name, '') || ' ' || 
  COALESCE(phone1, '') || ' ' || 
  COALESCE(email1, '') || ' ' || 
  COALESCE(property_address, '')
));

-- Partial indexes for active records (only index non-DNC contacts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_active_dnc ON contacts(id) WHERE dnc = false;

-- Composite index for common filtering patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_filter_combo ON contacts(deal_status, property_type, city, state, created_at DESC);

-- Index for value-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_value_range ON contacts(est_value) WHERE est_value IS NOT NULL;

-- Print completion message
SELECT 'Performance indexes created successfully! Your CRM is now optimized for 500K+ contacts.' as status;

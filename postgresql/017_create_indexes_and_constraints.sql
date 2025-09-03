-- Additional indexes for performance optimization

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_contacts_fulltext ON contacts 
    USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(llc_name, '') || ' ' || COALESCE(notes, '')));

CREATE INDEX IF NOT EXISTS idx_deals_fulltext ON deals 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(notes, '')));

CREATE INDEX IF NOT EXISTS idx_activities_fulltext ON activities 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_status_created ON contacts(deal_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_city_state_type ON contacts(city, state, property_type);
CREATE INDEX IF NOT EXISTS idx_messages_contact_timestamp ON messages(contact_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calls_contact_timestamp ON calls(contact_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emails_contact_timestamp ON emails(contact_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activities_contact_due ON activities(contact_id, due_date);
CREATE INDEX IF NOT EXISTS idx_deals_stage_value ON deals(stage, value DESC);
CREATE INDEX IF NOT EXISTS idx_deals_close_date_stage ON deals(expected_close_date, stage);

-- Partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_contacts_active_dnc ON contacts(id) WHERE dnc = false;
CREATE INDEX IF NOT EXISTS idx_deals_active ON deals(id) WHERE stage NOT IN ('closed_won', 'closed_lost');
CREATE INDEX IF NOT EXISTS idx_activities_pending ON activities(id) WHERE status IN ('planned', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(id) WHERE unread_count > 0;

-- Check constraints for data validation
ALTER TABLE contacts ADD CONSTRAINT chk_contacts_phone_format 
    CHECK (phone1 ~ '^\+?[1-9]\d{1,14}$' OR phone1 IS NULL);

ALTER TABLE contacts ADD CONSTRAINT chk_contacts_email_format 
    CHECK (email1 ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email1 IS NULL);

ALTER TABLE contacts ADD CONSTRAINT chk_contacts_value_positive 
    CHECK (est_value >= 0 OR est_value IS NULL);

ALTER TABLE deals ADD CONSTRAINT chk_deals_value_positive 
    CHECK (value >= 0);

ALTER TABLE deals ADD CONSTRAINT chk_deals_close_dates 
    CHECK (actual_close_date IS NULL OR expected_close_date IS NULL OR actual_close_date >= expected_close_date);

ALTER TABLE activities ADD CONSTRAINT chk_activities_completion 
    CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status != 'completed' AND completed_at IS NULL));

-- Foreign key constraints with proper naming
ALTER TABLE contact_tags ADD CONSTRAINT fk_contact_tags_contact 
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

ALTER TABLE contact_tags ADD CONSTRAINT fk_contact_tags_tag 
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

ALTER TABLE deal_tags ADD CONSTRAINT fk_deal_tags_deal 
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE deal_tags ADD CONSTRAINT fk_deal_tags_tag 
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

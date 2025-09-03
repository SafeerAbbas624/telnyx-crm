-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    deal_id UUID,
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'text', 'task', 'note', 'follow_up', 'appointment', 'demo')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'overdue')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID,
    location VARCHAR(500),
    duration_minutes INTEGER,
    reminder_minutes INTEGER,
    is_all_day BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    parent_activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    external_calendar_id VARCHAR(255),
    external_event_id VARCHAR(255),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,
    result TEXT,
    next_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_priority ON activities(priority);
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_completed_at ON activities(completed_at);
CREATE INDEX IF NOT EXISTS idx_activities_parent_id ON activities(parent_activity_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_activities_updated_at 
    BEFORE UPDATE ON activities
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to automatically set status to overdue
CREATE OR REPLACE FUNCTION check_activity_overdue()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.due_date < NOW() AND NEW.status = 'planned' THEN
        NEW.status = 'overdue';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activity_overdue_status
    BEFORE UPDATE ON activities
    FOR EACH ROW
    EXECUTE FUNCTION check_activity_overdue();

-- Add comments
COMMENT ON TABLE activities IS 'Tasks, appointments, and activities related to contacts and deals';
COMMENT ON COLUMN activities.recurrence_rule IS 'RRULE for recurring activities';
COMMENT ON COLUMN activities.result IS 'Outcome or result of completed activity';

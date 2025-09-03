-- Create useful views for common queries

-- View for contact summary with latest activity
CREATE OR REPLACE VIEW contact_summary AS
SELECT 
    c.*,
    COALESCE(msg_stats.last_message_at, call_stats.last_call_at, email_stats.last_email_at) as last_contact_at,
    COALESCE(msg_stats.message_count, 0) as message_count,
    COALESCE(call_stats.call_count, 0) as call_count,
    COALESCE(email_stats.email_count, 0) as email_count,
    COALESCE(activity_stats.pending_activities, 0) as pending_activities,
    COALESCE(deal_stats.active_deals, 0) as active_deals,
    COALESCE(deal_stats.total_deal_value, 0) as total_deal_value
FROM contacts c
LEFT JOIN (
    SELECT 
        contact_id,
        COUNT(*) as message_count,
        MAX(timestamp) as last_message_at
    FROM messages 
    GROUP BY contact_id
) msg_stats ON c.id = msg_stats.contact_id
LEFT JOIN (
    SELECT 
        contact_id,
        COUNT(*) as call_count,
        MAX(timestamp) as last_call_at
    FROM calls 
    GROUP BY contact_id
) call_stats ON c.id = call_stats.contact_id
LEFT JOIN (
    SELECT 
        contact_id,
        COUNT(*) as email_count,
        MAX(timestamp) as last_email_at
    FROM emails 
    GROUP BY contact_id
) email_stats ON c.id = email_stats.contact_id
LEFT JOIN (
    SELECT 
        contact_id,
        COUNT(*) as pending_activities
    FROM activities 
    WHERE status IN ('planned', 'in_progress')
    GROUP BY contact_id
) activity_stats ON c.id = activity_stats.contact_id
LEFT JOIN (
    SELECT 
        contact_id,
        COUNT(*) as active_deals,
        SUM(value) as total_deal_value
    FROM deals 
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY contact_id
) deal_stats ON c.id = deal_stats.contact_id;

-- View for deal pipeline summary
CREATE OR REPLACE VIEW deal_pipeline AS
SELECT 
    d.*,
    c.first_name,
    c.last_name,
    c.phone1,
    c.email1,
    EXTRACT(DAYS FROM (d.expected_close_date - CURRENT_DATE)) as days_to_close,
    CASE 
        WHEN d.expected_close_date < CURRENT_DATE AND d.stage NOT IN ('closed_won', 'closed_lost') 
        THEN true 
        ELSE false 
    END as is_overdue
FROM deals d
JOIN contacts c ON d.contact_id = c.id;

-- View for activity dashboard
CREATE OR REPLACE VIEW activity_dashboard AS
SELECT 
    a.*,
    c.first_name,
    c.last_name,
    c.phone1,
    c.email1,
    d.name as deal_name,
    CASE 
        WHEN a.due_date < NOW() AND a.status = 'planned' 
        THEN true 
        ELSE false 
    END as is_overdue,
    EXTRACT(DAYS FROM (a.due_date - NOW())) as days_until_due
FROM activities a
JOIN contacts c ON a.contact_id = c.id
LEFT JOIN deals d ON a.deal_id = d.id;

-- Function to get contact tags as array
CREATE OR REPLACE FUNCTION get_contact_tags(contact_uuid UUID)
RETURNS TEXT[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT t.name 
        FROM tags t
        JOIN contact_tags ct ON t.id = ct.tag_id
        WHERE ct.contact_id = contact_uuid
        ORDER BY t.name
    );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate contact score based on activities
CREATE OR REPLACE FUNCTION calculate_contact_score(contact_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    message_count INTEGER;
    call_count INTEGER;
    email_count INTEGER;
    recent_activity_count INTEGER;
    deal_value NUMERIC;
BEGIN
    -- Count messages (1 point each)
    SELECT COUNT(*) INTO message_count FROM messages WHERE contact_id = contact_uuid;
    score := score + message_count;
    
    -- Count calls (2 points each)
    SELECT COUNT(*) INTO call_count FROM calls WHERE contact_id = contact_uuid;
    score := score + (call_count * 2);
    
    -- Count emails (1 point each)
    SELECT COUNT(*) INTO email_count FROM emails WHERE contact_id = contact_uuid;
    score := score + email_count;
    
    -- Recent activity bonus (last 30 days, 5 points each)
    SELECT COUNT(*) INTO recent_activity_count 
    FROM activities 
    WHERE contact_id = contact_uuid 
    AND created_at > NOW() - INTERVAL '30 days';
    score := score + (recent_activity_count * 5);
    
    -- Deal value bonus (1 point per $1000)
    SELECT COALESCE(SUM(value), 0) INTO deal_value 
    FROM deals 
    WHERE contact_id = contact_uuid 
    AND stage NOT IN ('closed_lost');
    score := score + (deal_value / 1000)::INTEGER;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to update conversation stats when messages are inserted
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO conversations (contact_id, phone_number, last_message_id, last_message_content, last_message_at, last_message_direction, message_count, unread_count)
    VALUES (
        NEW.contact_id,
        NEW.phone_number,
        NEW.id,
        NEW.content,
        NEW.timestamp,
        NEW.direction,
        1,
        CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END
    )
    ON CONFLICT (contact_id, phone_number) 
    DO UPDATE SET
        last_message_id = NEW.id,
        last_message_content = NEW.content,
        last_message_at = NEW.timestamp,
        last_message_direction = NEW.direction,
        message_count = conversations.message_count + 1,
        unread_count = CASE 
            WHEN NEW.direction = 'inbound' 
            THEN conversations.unread_count + 1 
            ELSE conversations.unread_count 
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversation stats
CREATE TRIGGER update_conversation_stats_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_stats();

-- Add unique constraint to conversations
ALTER TABLE conversations ADD CONSTRAINT unique_contact_phone 
    UNIQUE (contact_id, phone_number);

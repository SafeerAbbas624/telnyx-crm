-- Create deal_stage_history table
CREATE TABLE IF NOT EXISTS deal_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    old_stage VARCHAR(50),
    new_stage VARCHAR(50) NOT NULL,
    old_value NUMERIC(15,2),
    new_value NUMERIC(15,2),
    old_probability INTEGER,
    new_probability INTEGER,
    changed_by UUID,
    change_reason TEXT,
    notes TEXT,
    duration_in_stage INTERVAL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for deal stage history
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_id ON deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_changed_at ON deal_stage_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_changed_by ON deal_stage_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_new_stage ON deal_stage_history(new_stage);

-- Create function to automatically log stage changes
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage OR 
       OLD.value IS DISTINCT FROM NEW.value OR 
       OLD.probability IS DISTINCT FROM NEW.probability THEN
        
        INSERT INTO deal_stage_history (
            deal_id, 
            old_stage, 
            new_stage, 
            old_value, 
            new_value,
            old_probability,
            new_probability,
            duration_in_stage,
            changed_at
        ) VALUES (
            NEW.id,
            OLD.stage,
            NEW.stage,
            OLD.value,
            NEW.value,
            OLD.probability,
            NEW.probability,
            NOW() - OLD.updated_at,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log stage changes
CREATE TRIGGER log_deal_stage_changes
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION log_deal_stage_change();

-- Add comments
COMMENT ON TABLE deal_stage_history IS 'Historical record of deal stage changes and value updates';
COMMENT ON COLUMN deal_stage_history.duration_in_stage IS 'How long the deal was in the previous stage';

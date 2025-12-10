-- Add dynamic tag sync fields to power_dialer_lists table
-- This allows lists to automatically sync contacts based on tags

-- Add new columns for tag-based dynamic sync
ALTER TABLE power_dialer_lists
  ADD COLUMN IF NOT EXISTS sync_tag_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER DEFAULT 1;

-- Create index for finding lists that need syncing
CREATE INDEX IF NOT EXISTS idx_power_dialer_lists_auto_sync 
  ON power_dialer_lists(auto_sync, last_sync_at) 
  WHERE auto_sync = true;

-- Comment on columns
COMMENT ON COLUMN power_dialer_lists.sync_tag_ids IS 'Array of tag IDs to sync contacts from';
COMMENT ON COLUMN power_dialer_lists.auto_sync IS 'Whether to automatically sync contacts with matching tags';
COMMENT ON COLUMN power_dialer_lists.last_sync_at IS 'Timestamp of last tag sync';
COMMENT ON COLUMN power_dialer_lists.sync_interval_minutes IS 'How often to sync in minutes (default 1)';


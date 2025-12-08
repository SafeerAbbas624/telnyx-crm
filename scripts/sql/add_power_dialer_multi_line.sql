-- Multi-Line Power Dialer Schema Updates
-- Adds new columns to power_dialer_lists and new tables for tracking runs and legs

-- Add new columns to power_dialer_lists
ALTER TABLE "power_dialer_lists"
ADD COLUMN IF NOT EXISTS "max_lines" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "caller_id_strategy" TEXT NOT NULL DEFAULT 'round_robin',
ADD COLUMN IF NOT EXISTS "current_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "contacts_voicemail" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "contacts_busy" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "contacts_failed" INTEGER NOT NULL DEFAULT 0;

-- Create power_dialer_runs table
CREATE TABLE IF NOT EXISTS "power_dialer_runs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "list_id" UUID NOT NULL REFERENCES "power_dialer_lists"("id") ON DELETE CASCADE,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "max_lines" INTEGER NOT NULL DEFAULT 3,
    "selected_numbers" TEXT[] NOT NULL DEFAULT '{}',
    "caller_id_strategy" TEXT NOT NULL DEFAULT 'round_robin',
    "script_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "current_index" INTEGER NOT NULL DEFAULT 0,
    "total_contacts" INTEGER NOT NULL DEFAULT 0,
    "total_attempted" INTEGER NOT NULL DEFAULT 0,
    "total_answered" INTEGER NOT NULL DEFAULT 0,
    "total_no_answer" INTEGER NOT NULL DEFAULT 0,
    "total_voicemail" INTEGER NOT NULL DEFAULT 0,
    "total_busy" INTEGER NOT NULL DEFAULT 0,
    "total_failed" INTEGER NOT NULL DEFAULT 0,
    "total_canceled" INTEGER NOT NULL DEFAULT 0,
    "total_talk_time" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "paused_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for power_dialer_runs
CREATE INDEX IF NOT EXISTS "idx_power_dialer_runs_list_status" ON "power_dialer_runs"("list_id", "status");
CREATE INDEX IF NOT EXISTS "idx_power_dialer_runs_user_created" ON "power_dialer_runs"("user_id", "created_at" DESC);

-- Create power_dialer_run_legs table
CREATE TABLE IF NOT EXISTS "power_dialer_run_legs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL REFERENCES "power_dialer_runs"("id") ON DELETE CASCADE,
    "list_contact_id" UUID NOT NULL REFERENCES "power_dialer_list_contacts"("id") ON DELETE CASCADE,
    "telnyx_call_control_id" TEXT,
    "telnyx_session_id" TEXT,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "amd_result" TEXT,
    "hangup_cause" TEXT,
    "sip_response_code" INTEGER,
    "ring_duration_ms" INTEGER,
    "talk_duration_ms" INTEGER,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "answered_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ
);

-- Create indexes for power_dialer_run_legs
CREATE INDEX IF NOT EXISTS "idx_power_dialer_run_legs_run_status" ON "power_dialer_run_legs"("run_id", "status");
CREATE INDEX IF NOT EXISTS "idx_power_dialer_run_legs_telnyx" ON "power_dialer_run_legs"("telnyx_call_control_id");


-- Create Power Dialer enums
DO $$ BEGIN
    CREATE TYPE "PowerDialerStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'COMPLETED', 'STOPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "QueueItemStatus" AS ENUM ('PENDING', 'CALLING', 'COMPLETED', 'FAILED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PowerDialerCallStatus" AS ENUM ('INITIATED', 'RINGING', 'ANSWERED', 'BUSY', 'NO_ANSWER', 'FAILED', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create PowerDialerSession table
CREATE TABLE IF NOT EXISTS "power_dialer_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "concurrent_lines" INTEGER NOT NULL DEFAULT 1,
    "selected_numbers" TEXT[] NOT NULL DEFAULT '{}',
    "status" "PowerDialerStatus" NOT NULL DEFAULT 'IDLE',
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "total_contacted" INTEGER NOT NULL DEFAULT 0,
    "total_answered" INTEGER NOT NULL DEFAULT 0,
    "total_no_answer" INTEGER NOT NULL DEFAULT 0,
    "total_talk_time" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "paused_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_power_dialer_sessions_user_status" ON "power_dialer_sessions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_power_dialer_sessions_created" ON "power_dialer_sessions"("created_at" DESC);

-- Create PowerDialerQueue table
CREATE TABLE IF NOT EXISTS "power_dialer_queue" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL REFERENCES "power_dialer_sessions"("id") ON DELETE CASCADE,
    "contact_id" UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_attempt_at" TIMESTAMPTZ,
    "was_contacted" BOOLEAN NOT NULL DEFAULT false,
    "was_answered" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_power_dialer_queue_session_status" ON "power_dialer_queue"("session_id", "status");
CREATE INDEX IF NOT EXISTS "idx_power_dialer_queue_session_priority" ON "power_dialer_queue"("session_id", "priority" DESC);

-- Create PowerDialerCall table
CREATE TABLE IF NOT EXISTS "power_dialer_calls" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL REFERENCES "power_dialer_sessions"("id") ON DELETE CASCADE,
    "queue_item_id" UUID NOT NULL REFERENCES "power_dialer_queue"("id") ON DELETE CASCADE,
    "contact_id" UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "webrtc_session_id" TEXT,
    "telnyx_call_id" TEXT,
    "status" "PowerDialerCallStatus" NOT NULL DEFAULT 'INITIATED',
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "dropped_busy" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "answered_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_power_dialer_calls_session_status" ON "power_dialer_calls"("session_id", "status");
CREATE INDEX IF NOT EXISTS "idx_power_dialer_calls_queue_item" ON "power_dialer_calls"("queue_item_id");
CREATE INDEX IF NOT EXISTS "idx_power_dialer_calls_contact" ON "power_dialer_calls"("contact_id");


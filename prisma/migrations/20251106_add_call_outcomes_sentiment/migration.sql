-- Add call outcome and sentiment fields to telnyx_calls
ALTER TABLE "telnyx_calls" ADD COLUMN "call_outcome" VARCHAR(50);
ALTER TABLE "telnyx_calls" ADD COLUMN "call_notes" TEXT;
ALTER TABLE "telnyx_calls" ADD COLUMN "disposition_set_at" TIMESTAMPTZ;
ALTER TABLE "telnyx_calls" ADD COLUMN "disposition_set_by" UUID;
ALTER TABLE "telnyx_calls" ADD COLUMN "automation_triggered" BOOLEAN DEFAULT false;
ALTER TABLE "telnyx_calls" ADD COLUMN "automation_actions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "telnyx_calls" ADD COLUMN "sentiment" VARCHAR(20);
ALTER TABLE "telnyx_calls" ADD COLUMN "sentiment_score" INTEGER;
ALTER TABLE "telnyx_calls" ADD COLUMN "sentiment_summary" TEXT;
ALTER TABLE "telnyx_calls" ADD COLUMN "transcript" TEXT;
ALTER TABLE "telnyx_calls" ADD COLUMN "transcript_searchable" TEXT;
ALTER TABLE "telnyx_calls" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create indexes for telnyx_calls
CREATE INDEX "idx_telnyx_calls_outcome" ON "telnyx_calls"("call_outcome");
CREATE INDEX "idx_telnyx_calls_sentiment" ON "telnyx_calls"("sentiment");
CREATE INDEX "idx_telnyx_calls_created" ON "telnyx_calls"("created_at" DESC);

-- Add call outcome and sentiment fields to vapi_calls
ALTER TABLE "vapi_calls" ADD COLUMN "transcript_searchable" TEXT;
ALTER TABLE "vapi_calls" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "vapi_calls" ADD COLUMN "call_outcome" VARCHAR(50);
ALTER TABLE "vapi_calls" ADD COLUMN "call_notes" TEXT;
ALTER TABLE "vapi_calls" ADD COLUMN "disposition_set_at" TIMESTAMPTZ;
ALTER TABLE "vapi_calls" ADD COLUMN "disposition_set_by" UUID;
ALTER TABLE "vapi_calls" ADD COLUMN "automation_triggered" BOOLEAN DEFAULT false;
ALTER TABLE "vapi_calls" ADD COLUMN "automation_actions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "vapi_calls" ADD COLUMN "sentiment" VARCHAR(20);
ALTER TABLE "vapi_calls" ADD COLUMN "sentiment_score" INTEGER;
ALTER TABLE "vapi_calls" ADD COLUMN "sentiment_summary" TEXT;

-- Create indexes for vapi_calls
CREATE INDEX "idx_vapi_calls_outcome" ON "vapi_calls"("call_outcome");
CREATE INDEX "idx_vapi_calls_sentiment" ON "vapi_calls"("sentiment");
CREATE INDEX "idx_vapi_calls_created" ON "vapi_calls"("created_at" DESC);

-- Add call outcome and sentiment fields to power_dialer_calls (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'power_dialer_calls') THEN
    ALTER TABLE "power_dialer_calls" ADD COLUMN IF NOT EXISTS "call_outcome" VARCHAR(50);
    ALTER TABLE "power_dialer_calls" ADD COLUMN IF NOT EXISTS "call_notes" TEXT;
    ALTER TABLE "power_dialer_calls" ADD COLUMN IF NOT EXISTS "disposition_set_at" TIMESTAMPTZ;
    ALTER TABLE "power_dialer_calls" ADD COLUMN IF NOT EXISTS "sentiment" VARCHAR(20);
    ALTER TABLE "power_dialer_calls" ADD COLUMN IF NOT EXISTS "sentiment_score" INTEGER;
    ALTER TABLE "power_dialer_calls" ADD COLUMN IF NOT EXISTS "sentiment_summary" TEXT;

    -- Create indexes for power_dialer_calls
    CREATE INDEX IF NOT EXISTS "idx_power_dialer_calls_outcome" ON "power_dialer_calls"("call_outcome");
    CREATE INDEX IF NOT EXISTS "idx_power_dialer_calls_sentiment" ON "power_dialer_calls"("sentiment");
  END IF;
END $$;


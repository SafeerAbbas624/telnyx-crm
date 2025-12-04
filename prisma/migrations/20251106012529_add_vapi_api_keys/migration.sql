-- CreateTable
CREATE TABLE "vapi_api_keys" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "default_assistant_id" TEXT,
    "default_phone_number" TEXT,
    "max_call_duration" INTEGER DEFAULT 600,
    "recording_enabled" BOOLEAN NOT NULL DEFAULT true,
    "transcript_enabled" BOOLEAN NOT NULL DEFAULT true,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "last_tested_at" TIMESTAMPTZ(6),
    "test_status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vapi_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_vapi_api_keys_is_active" ON "vapi_api_keys"("is_active");

-- CreateIndex
CREATE INDEX "idx_vapi_api_keys_is_default" ON "vapi_api_keys"("is_default");


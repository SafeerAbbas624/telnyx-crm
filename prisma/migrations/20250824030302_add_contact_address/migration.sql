/*
  Warnings:

  - You are about to drop the `Contact` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TextBlastStatus" AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('sms', 'mms');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sent', 'delivered', 'read', 'failed', 'pending');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('completed', 'missed', 'voicemail', 'failed', 'busy', 'no_answer', 'cancelled');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('voice', 'conference', 'forwarded');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('sent', 'delivered', 'read', 'failed', 'bounced', 'spam', 'pending');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('call', 'meeting', 'email', 'text', 'task', 'note', 'follow_up', 'appointment', 'demo');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled', 'overdue');

-- CreateEnum
CREATE TYPE "ActivityPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'contract', 'closing', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('contract', 'invoice', 'receipt', 'photo', 'document', 'presentation', 'spreadsheet', 'other');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('sms', 'whatsapp', 'email', 'voice');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'closed', 'spam', 'blocked');

-- CreateEnum
CREATE TYPE "ConversationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AssistantModelProvider" AS ENUM ('openai', 'anthropic', 'together_ai', 'anyscale');

-- CreateEnum
CREATE TYPE "AssistantVoiceProvider" AS ENUM ('11labs', 'playht', 'rime_ai', 'neets', 'openai');

-- CreateEnum
CREATE TYPE "PhoneNumberProvider" AS ENUM ('twilio', 'vonage', 'vapi');

-- CreateEnum
CREATE TYPE "VapiCallType" AS ENUM ('inboundPhoneCall', 'outboundPhoneCall', 'webCall');

-- CreateEnum
CREATE TYPE "VapiCallStatus" AS ENUM ('queued', 'ringing', 'in_progress', 'forwarding', 'ended');

-- CreateEnum
CREATE TYPE "VapiCallProvider" AS ENUM ('twilio', 'vonage', 'vapi');

-- CreateEnum
CREATE TYPE "VapiCallTransport" AS ENUM ('sip', 'pstn');

-- CreateEnum
CREATE TYPE "TelnyxMessageStatus" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'delivery_failed', 'failed', 'received');

-- CreateEnum
CREATE TYPE "TelnyxCallStatus" AS ENUM ('initiated', 'ringing', 'answered', 'bridged', 'hangup', 'failed');

-- CreateEnum
CREATE TYPE "TelnyxBillingType" AS ENUM ('sms', 'call', 'number_rental');

-- DropTable
DROP TABLE "Contact";

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "llc_name" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "phone3" TEXT,
    "email1" TEXT,
    "email2" TEXT,
    "email3" TEXT,
    "property_address" TEXT,
    "contact_address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "property_county" TEXT,
    "property_type" TEXT,
    "bedrooms" INTEGER,
    "total_bathrooms" DECIMAL(4,2),
    "building_sqft" INTEGER,
    "effective_year_built" INTEGER,
    "est_value" DECIMAL(15,2),
    "est_equity" DECIMAL(15,2),
    "dnc" BOOLEAN DEFAULT false,
    "dnc_reason" TEXT,
    "deal_status" "DealStatus" DEFAULT 'lead',
    "notes" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "description" TEXT,
    "is_system" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "conversation_id" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MessageStatus" NOT NULL DEFAULT 'sent',
    "message_type" "MessageType" DEFAULT 'sms',
    "phone_number" TEXT,
    "message_sid" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "media_urls" TEXT[],
    "cost" DECIMAL(10,4),
    "segments" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "duration" INTEGER DEFAULT 0,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CallStatus" NOT NULL,
    "call_type" "CallType" DEFAULT 'voice',
    "from_number" TEXT,
    "to_number" TEXT,
    "call_sid" TEXT,
    "recording_url" TEXT,
    "recording_duration" INTEGER,
    "cost" DECIMAL(10,4),
    "notes" TEXT,
    "answered_by" TEXT,
    "hangup_cause" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EmailStatus" NOT NULL DEFAULT 'sent',
    "from_email" TEXT,
    "to_email" TEXT,
    "cc_emails" TEXT[],
    "bcc_emails" TEXT[],
    "reply_to" TEXT,
    "message_id" TEXT,
    "thread_id" TEXT,
    "in_reply_to" TEXT,
    "attachments" JSONB DEFAULT '[]',
    "headers" JSONB DEFAULT '{}',
    "bounce_reason" TEXT,
    "spam_score" DECIMAL(3,2),
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "deal_id" UUID,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMPTZ(6),
    "status" "ActivityStatus" NOT NULL DEFAULT 'planned',
    "priority" "ActivityPriority" DEFAULT 'medium',
    "assigned_to" UUID,
    "location" TEXT,
    "duration_minutes" INTEGER,
    "reminder_minutes" INTEGER,
    "is_all_day" BOOLEAN DEFAULT false,
    "recurrence_rule" TEXT,
    "parent_activity_id" UUID,
    "external_calendar_id" TEXT,
    "external_event_id" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" UUID,
    "result" TEXT,
    "next_action" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'lead',
    "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "probability" INTEGER DEFAULT 0,
    "expected_close_date" DATE,
    "actual_close_date" DATE,
    "source" TEXT,
    "campaign" TEXT,
    "lead_score" INTEGER DEFAULT 0,
    "assigned_to" UUID,
    "team_id" UUID,
    "pipeline" TEXT DEFAULT 'default',
    "lost_reason" TEXT,
    "won_reason" TEXT,
    "competitor" TEXT,
    "next_step" TEXT,
    "notes" TEXT,
    "custom_fields" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_tags" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "deal_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_stage_history" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "old_stage" TEXT,
    "new_stage" TEXT NOT NULL,
    "old_value" DECIMAL(15,2),
    "new_value" DECIMAL(15,2),
    "old_probability" INTEGER,
    "new_probability" INTEGER,
    "changed_by" UUID,
    "change_reason" TEXT,
    "notes" TEXT,
    "duration_in_stage" interval,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "contact_id" UUID,
    "deal_id" UUID,
    "activity_id" UUID,
    "name" TEXT NOT NULL,
    "original_name" TEXT,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "file_extension" TEXT,
    "document_type" "DocumentType",
    "category" TEXT,
    "description" TEXT,
    "is_public" BOOLEAN DEFAULT false,
    "is_archived" BOOLEAN DEFAULT false,
    "version" INTEGER DEFAULT 1,
    "parent_document_id" UUID,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMPTZ(6),
    "access_count" INTEGER DEFAULT 0,
    "tags" TEXT[],
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "channel" "ConversationChannel" DEFAULT 'sms',
    "last_message_id" UUID,
    "last_message_content" TEXT,
    "last_message_at" TIMESTAMPTZ(6),
    "last_message_direction" "MessageDirection",
    "last_sender_number" TEXT,
    "message_count" INTEGER DEFAULT 0,
    "unread_count" INTEGER DEFAULT 0,
    "is_archived" BOOLEAN DEFAULT false,
    "is_starred" BOOLEAN DEFAULT false,
    "is_muted" BOOLEAN DEFAULT false,
    "assigned_to" UUID,
    "status" "ConversationStatus" DEFAULT 'active',
    "priority" "ConversationPriority" DEFAULT 'normal',
    "labels" TEXT[],
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "first_message" TEXT,
    "system_prompt" TEXT,
    "model_provider" "AssistantModelProvider" DEFAULT 'openai',
    "model" TEXT DEFAULT 'gpt-3.5-turbo',
    "voice_provider" "AssistantVoiceProvider" DEFAULT 'playht',
    "voice_id" TEXT,
    "voice_settings" JSONB DEFAULT '{}',
    "language" TEXT DEFAULT 'en',
    "response_delay_seconds" DECIMAL(4,2),
    "llm_request_delay_seconds" DECIMAL(4,2),
    "interruption_threshold" INTEGER DEFAULT 100,
    "max_duration_seconds" INTEGER DEFAULT 1800,
    "silence_timeout_seconds" INTEGER DEFAULT 30,
    "background_sound" TEXT DEFAULT 'office',
    "backchaneling_enabled" BOOLEAN DEFAULT false,
    "background_denoising_enabled" BOOLEAN DEFAULT true,
    "model_output_in_messages_enabled" BOOLEAN DEFAULT false,
    "transport_configurations" JSONB DEFAULT '{}',
    "recording_enabled" BOOLEAN DEFAULT true,
    "video_recording_enabled" BOOLEAN DEFAULT false,
    "end_call_message" TEXT,
    "end_call_phrases" TEXT[],
    "voicemail_detection_enabled" BOOLEAN DEFAULT true,
    "voicemail_message" TEXT,
    "analysis_plan" JSONB DEFAULT '{}',
    "artifact_plan" JSONB DEFAULT '{}',
    "message_plan" JSONB DEFAULT '{}',
    "start_speaking_plan" JSONB DEFAULT '{}',
    "stop_speaking_plan" JSONB DEFAULT '{}',
    "monitor_plan" JSONB DEFAULT '{}',
    "credential_ids" JSONB DEFAULT '{}',
    "server_url" TEXT,
    "server_url_secret" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "usage_count" INTEGER DEFAULT 0,
    "success_rate" DECIMAL(5,2),
    "average_duration" INTEGER DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assistants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "formatted_number" TEXT,
    "country_code" TEXT DEFAULT '+1',
    "area_code" TEXT,
    "name" TEXT,
    "provider" "PhoneNumberProvider" DEFAULT 'twilio',
    "provider_account_sid" TEXT,
    "provider_phone_number_id" TEXT,
    "assistant_id" UUID,
    "squad_id" UUID,
    "server_url" TEXT,
    "server_url_secret" TEXT,
    "capabilities" TEXT[] DEFAULT ARRAY['voice', 'sms']::TEXT[],
    "voice_settings" JSONB DEFAULT '{}',
    "sms_settings" JSONB DEFAULT '{}',
    "fallback_destination" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "is_verified" BOOLEAN DEFAULT false,
    "purchase_date" DATE,
    "monthly_cost" DECIMAL(8,2),
    "usage_count" INTEGER DEFAULT 0,
    "last_used_at" TIMESTAMPTZ(6),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vapi_calls" (
    "id" UUID NOT NULL,
    "vapi_call_id" TEXT,
    "org_id" TEXT,
    "assistant_id" UUID,
    "assistant_overrides" JSONB DEFAULT '{}',
    "squad_id" UUID,
    "phone_number_id" UUID,
    "customer_id" UUID,
    "name" TEXT,
    "type" "VapiCallType" NOT NULL,
    "status" "VapiCallStatus" DEFAULT 'queued',
    "ended_reason" TEXT,
    "messages" JSONB DEFAULT '[]',
    "messages_openai_formatted" JSONB DEFAULT '[]',
    "phone_call_provider" "VapiCallProvider" DEFAULT 'twilio',
    "phone_call_provider_id" TEXT,
    "phone_call_transport" "VapiCallTransport" DEFAULT 'pstn',
    "phone_call_provider_details" JSONB DEFAULT '{}',
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration" INTEGER,
    "cost" DECIMAL(10,4),
    "cost_breakdown" JSONB DEFAULT '{}',
    "transcript" TEXT,
    "recording_url" TEXT,
    "stereo_recording_url" TEXT,
    "mono_recording_url" TEXT,
    "summary" TEXT,
    "analysis" JSONB DEFAULT '{}',
    "artifacts" JSONB DEFAULT '[]',
    "monitor" JSONB DEFAULT '{}',
    "credential_ids_used" JSONB DEFAULT '{}',
    "transport_configuration_twilio" JSONB DEFAULT '{}',
    "transport_configuration_vonage" JSONB DEFAULT '{}',
    "transport_configuration_vapi" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vapi_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_history" (
    "id" UUID NOT NULL,
    "file_name" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_records" INTEGER,
    "imported_count" INTEGER,
    "duplicate_count" INTEGER,
    "missing_phone_count" INTEGER,
    "errors" JSONB,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telnyx_phone_numbers" (
    "id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "telnyx_id" TEXT,
    "state" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" TEXT[] DEFAULT ARRAY['SMS', 'VOICE']::TEXT[],
    "monthly_price" DECIMAL(8,2),
    "setup_price" DECIMAL(8,2),
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "total_sms_count" INTEGER NOT NULL DEFAULT 0,
    "total_call_count" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telnyx_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telnyx_messages" (
    "id" UUID NOT NULL,
    "telnyx_message_id" TEXT,
    "contact_id" UUID,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "TelnyxMessageStatus" NOT NULL DEFAULT 'queued',
    "cost" DECIMAL(10,4),
    "segments" INTEGER DEFAULT 1,
    "error_code" TEXT,
    "error_message" TEXT,
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "webhook_data" JSONB,
    "blast_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telnyx_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telnyx_calls" (
    "id" UUID NOT NULL,
    "telnyx_call_id" TEXT,
    "contact_id" UUID NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "status" "TelnyxCallStatus" NOT NULL DEFAULT 'initiated',
    "duration" INTEGER DEFAULT 0,
    "cost" DECIMAL(10,4),
    "recording_url" TEXT,
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "hangup_cause" TEXT,
    "webhook_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telnyx_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telnyx_billing" (
    "id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "record_type" "TelnyxBillingType" NOT NULL,
    "record_id" TEXT NOT NULL,
    "cost" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telnyx_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_blasts" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "message" TEXT NOT NULL,
    "total_contacts" INTEGER NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "TextBlastStatus" NOT NULL DEFAULT 'pending',
    "sender_numbers" JSONB NOT NULL,
    "delay_seconds" INTEGER NOT NULL DEFAULT 1,
    "contact_filters" JSONB,
    "selected_contacts" JSONB,
    "current_index" INTEGER NOT NULL DEFAULT 0,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_blasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contact_tags_contact_id_tag_id_key" ON "contact_tags"("contact_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_tags_deal_id_tag_id_key" ON "deal_tags"("deal_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_contact_id_phone_number_key" ON "conversations"("contact_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_number_key" ON "phone_numbers"("number");

-- CreateIndex
CREATE UNIQUE INDEX "vapi_calls_vapi_call_id_key" ON "vapi_calls"("vapi_call_id");

-- CreateIndex
CREATE UNIQUE INDEX "telnyx_phone_numbers_phone_number_key" ON "telnyx_phone_numbers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "telnyx_messages_telnyx_message_id_key" ON "telnyx_messages"("telnyx_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "telnyx_calls_telnyx_call_id_key" ON "telnyx_calls"("telnyx_call_id");

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telnyx_messages" ADD CONSTRAINT "telnyx_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

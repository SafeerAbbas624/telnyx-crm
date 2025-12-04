-- CreateTable: Pipeline
-- This table stores different business pipelines (Private Lender, Real Estate Wholesaling, Loan Officer Recruitment, etc.)
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(50) DEFAULT '#3B82F6',
    "icon" VARCHAR(50) DEFAULT 'briefcase',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- Add pipeline_id to contacts table
ALTER TABLE "contacts" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to activities table (tasks, calls, meetings, etc.)
ALTER TABLE "activities" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to message_templates table
ALTER TABLE "message_templates" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to email_templates table
ALTER TABLE "email_templates" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to task_templates table
ALTER TABLE "task_templates" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to deals table
ALTER TABLE "deals" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to tags table
ALTER TABLE "tags" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to text_blasts table
ALTER TABLE "text_blasts" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to text_automations table
ALTER TABLE "text_automations" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to filter_presets table
ALTER TABLE "filter_presets" ADD COLUMN "pipeline_id" UUID;

-- Add pipeline_id to power_dialer_lists table
ALTER TABLE "power_dialer_lists" ADD COLUMN "pipeline_id" UUID;

-- CreateTable: UserPipelineSettings
-- This table stores user-specific settings per pipeline (like task types, custom fields, etc.)
CREATE TABLE "user_pipeline_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "task_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pipeline_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserActivePipeline
-- This table tracks which pipeline each user is currently viewing/working in
CREATE TABLE "user_active_pipeline" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_active_pipeline_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "text_blasts" ADD CONSTRAINT "text_blasts_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "text_automations" ADD CONSTRAINT "text_automations_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "filter_presets" ADD CONSTRAINT "filter_presets_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "power_dialer_lists" ADD CONSTRAINT "power_dialer_lists_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_pipeline_settings" ADD CONSTRAINT "user_pipeline_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_pipeline_settings" ADD CONSTRAINT "user_pipeline_settings_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_active_pipeline" ADD CONSTRAINT "user_active_pipeline_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_active_pipeline" ADD CONSTRAINT "user_active_pipeline_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraints
ALTER TABLE "user_pipeline_settings" ADD CONSTRAINT "user_pipeline_settings_user_id_pipeline_id_key" UNIQUE ("user_id", "pipeline_id");
ALTER TABLE "user_active_pipeline" ADD CONSTRAINT "user_active_pipeline_user_id_key" UNIQUE ("user_id");

-- Add indexes for performance
CREATE INDEX "idx_contacts_pipeline_id" ON "contacts"("pipeline_id");
CREATE INDEX "idx_activities_pipeline_id" ON "activities"("pipeline_id");
CREATE INDEX "idx_message_templates_pipeline_id" ON "message_templates"("pipeline_id");
CREATE INDEX "idx_email_templates_pipeline_id" ON "email_templates"("pipeline_id");
CREATE INDEX "idx_task_templates_pipeline_id" ON "task_templates"("pipeline_id");
CREATE INDEX "idx_deals_pipeline_id" ON "deals"("pipeline_id");
CREATE INDEX "idx_tags_pipeline_id" ON "tags"("pipeline_id");
CREATE INDEX "idx_text_blasts_pipeline_id" ON "text_blasts"("pipeline_id");
CREATE INDEX "idx_text_automations_pipeline_id" ON "text_automations"("pipeline_id");
CREATE INDEX "idx_filter_presets_pipeline_id" ON "filter_presets"("pipeline_id");
CREATE INDEX "idx_power_dialer_lists_pipeline_id" ON "power_dialer_lists"("pipeline_id");
CREATE INDEX "idx_user_pipeline_settings_user_id" ON "user_pipeline_settings"("user_id");
CREATE INDEX "idx_user_pipeline_settings_pipeline_id" ON "user_pipeline_settings"("pipeline_id");
CREATE INDEX "idx_user_active_pipeline_user_id" ON "user_active_pipeline"("user_id");

-- Insert default pipelines
INSERT INTO "pipelines" ("name", "description", "color", "icon", "is_default", "display_order") VALUES
('Private Lender', 'Originating loans and private lending', '#10B981', 'dollar-sign', true, 1),
('Real Estate Wholesaling', 'Acquiring and wholesaling real estate properties', '#3B82F6', 'home', false, 2),
('Loan Officer Recruitment', 'Direct outreach for recruiting loan officers', '#F59E0B', 'users', false, 3);


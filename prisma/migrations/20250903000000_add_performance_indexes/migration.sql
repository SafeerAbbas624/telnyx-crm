-- CreateIndex
CREATE INDEX "idx_contacts_created_at" ON "contacts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_contacts_name" ON "contacts"("first_name", "last_name");

-- CreateIndex
CREATE INDEX "idx_contacts_phone1" ON "contacts"("phone1");

-- CreateIndex
CREATE INDEX "idx_contacts_email1" ON "contacts"("email1");

-- CreateIndex
CREATE INDEX "idx_contacts_status_created" ON "contacts"("deal_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_contacts_location" ON "contacts"("city", "state");

-- CreateIndex
CREATE INDEX "idx_contacts_property_type" ON "contacts"("property_type");

-- CreateIndex
CREATE INDEX "idx_contacts_dnc" ON "contacts"("dnc");

-- CreateIndex
CREATE INDEX "idx_conversations_contact" ON "conversations"("contact_id");

-- CreateIndex
CREATE INDEX "idx_conversations_last_message" ON "conversations"("last_message_at" DESC);

-- CreateIndex
CREATE INDEX "idx_conversations_unread" ON "conversations"("unread_count");

-- CreateIndex
CREATE INDEX "idx_conversations_assigned" ON "conversations"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_activities_contact_due" ON "activities"("contact_id", "due_date");

-- CreateIndex
-- CREATE INDEX "idx_activities_created_by" ON "activities"("created_by", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_activities_status_due" ON "activities"("status", "due_date");

-- CreateIndex
CREATE INDEX "idx_activities_assigned_due" ON "activities"("assigned_to", "due_date");

-- CreateIndex
CREATE INDEX "idx_telnyx_messages_contact_created" ON "telnyx_messages"("contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_telnyx_messages_from" ON "telnyx_messages"("from_number");

-- CreateIndex
CREATE INDEX "idx_telnyx_messages_to" ON "telnyx_messages"("to_number");

-- CreateIndex
CREATE INDEX "idx_telnyx_messages_direction_created" ON "telnyx_messages"("direction", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_telnyx_calls_contact_created" ON "telnyx_calls"("contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_telnyx_calls_from" ON "telnyx_calls"("from_number");

-- CreateIndex
CREATE INDEX "idx_telnyx_calls_to" ON "telnyx_calls"("to_number");

-- CreateIndex
CREATE INDEX "idx_telnyx_calls_direction_created" ON "telnyx_calls"("direction", "created_at" DESC);

-- CreateIndex (only if table exists)
-- CREATE INDEX "idx_contact_assignments_user" ON "contact_assignments"("user_id");

-- CreateIndex (only if table exists)
-- CREATE INDEX "idx_contact_assignments_contact" ON "contact_assignments"("contact_id");

-- CreateIndex (only if table exists)
-- CREATE INDEX "idx_contact_assignments_assigned_by" ON "contact_assignments"("assigned_by");

-- Additional composite indexes for common query patterns
CREATE INDEX "idx_contacts_search_text" ON "contacts" USING gin(to_tsvector('english', 
  COALESCE("first_name", '') || ' ' || 
  COALESCE("last_name", '') || ' ' || 
  COALESCE("llc_name", '') || ' ' || 
  COALESCE("phone1", '') || ' ' || 
  COALESCE("email1", '') || ' ' || 
  COALESCE("property_address", '')
));

-- Partial indexes for active records
CREATE INDEX "idx_contacts_active_dnc" ON "contacts"("id") WHERE "dnc" = false;
CREATE INDEX "idx_conversations_unread_active" ON "conversations"("id") WHERE "unread_count" > 0;
CREATE INDEX "idx_activities_pending" ON "activities"("id") WHERE "status" IN ('planned', 'in_progress');

# Database Schema Documentation

This directory contains SQL scripts to create the complete database schema for the contact management application.

## Overview

The database is designed for PostgreSQL and includes the following main components:

### Core Tables
- **contacts**: Main contact information with property details and financial data
- **tags**: Reusable labels for categorization
- **contact_tags**: Many-to-many relationship between contacts and tags

### Communication Tables
- **messages**: SMS/text message history with delivery status
- **calls**: Call logs with duration, recordings, and notes
- **emails**: Email communication records with threading support
- **conversations**: SMS conversation threads with unread counts

### Business Logic Tables
- **activities**: Tasks, meetings, follow-ups with due dates and priorities
- **deals**: Sales pipeline with stages, values, and probabilities
- **deal_tags**: Tags for deals
- **deal_stage_history**: Audit trail for deal progression
- **documents**: File attachments linked to contacts/deals

### AI/Voice Integration Tables
- **assistants**: AI assistant configurations for voice calls
- **phone_numbers**: Managed phone numbers with capabilities
- **vapi_calls**: Voice AI call logs with transcripts and analysis

## Execution Order

Run the SQL files in numerical order:

1. `001_create_contacts_table.sql` - Core contact information
2. `002_create_tags_table.sql` - Tag system with default tags
3. `003_create_contact_tags_table.sql` - Contact-tag relationships
4. `004_create_messages_table.sql` - SMS messaging system
5. `005_create_calls_table.sql` - Call logging system
6. `006_create_emails_table.sql` - Email communication system
7. `007_create_activities_table.sql` - Activity and task management
8. `008_create_deals_table.sql` - Sales pipeline management
9. `009_create_deal_tags_table.sql` - Deal tagging system
10. `010_create_deal_stage_history_table.sql` - Deal progression tracking
11. `011_create_documents_table.sql` - Document management
12. `012_create_conversations_table.sql` - Conversation threading
13. `013_create_assistants_table.sql` - AI assistant configuration
14. `014_create_phone_numbers_table.sql` - Phone number management
15. `015_create_vapi_calls_table.sql` - Voice AI call logging

## Key Features

### Data Types
- Uses UUID for primary keys
- JSONB for flexible metadata storage
- Arrays for multi-value fields
- Proper constraints and check conditions

### Performance
- Comprehensive indexing strategy
- Optimized for common query patterns
- Efficient foreign key relationships

### Audit Trail
- `created_at` and `updated_at` timestamps on all tables
- Automatic timestamp updates via triggers
- Deal stage history tracking

### Data Integrity
- Foreign key constraints with appropriate cascade rules
- Check constraints for enum-like values
- Unique constraints where appropriate

## Usage with Supabase

These scripts are designed to work with Supabase PostgreSQL. To use:

1. Create a new Supabase project
2. Run each SQL file in order in the SQL editor
3. Configure Row Level Security (RLS) policies as needed
4. Set up authentication and user management

## Environment Variables

When integrating with the Next.js application, you'll need:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

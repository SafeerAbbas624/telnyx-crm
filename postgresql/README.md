# PostgreSQL Database Schema

This directory contains the complete PostgreSQL database schema for the Contact Management and CRM system.

## Schema Overview

The database consists of 15 main tables with comprehensive relationships, indexes, and constraints:

### Core Tables
- **contacts** - Main contact information with property details
- **tags** - Categorization tags for contacts and deals
- **contact_tags** - Many-to-many relationship between contacts and tags

### Communication Tables
- **messages** - SMS/MMS message history
- **calls** - Phone call records with duration and status
- **emails** - Email communication tracking
- **conversations** - Conversation threads across channels

### Business Logic Tables
- **activities** - Tasks, meetings, and follow-ups
- **deals** - Sales opportunities and pipeline management
- **deal_tags** - Tags for deals
- **deal_stage_history** - Historical tracking of deal changes
- **documents** - File attachments and document management

### AI Integration Tables
- **assistants** - AI voice assistant configurations
- **phone_numbers** - Phone number management for AI calls
- **vapi_calls** - VAPI call records and analytics

## Installation Instructions

### Prerequisites
- PostgreSQL 12 or higher
- UUID extension (usually included)

### Setup Steps

1. **Create Database**
   \`\`\`sql
   CREATE DATABASE contact_crm;
   \c contact_crm;
   \`\`\`

2. **Enable Extensions**
   \`\`\`sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   \`\`\`

3. **Run Schema Scripts**
   Execute the SQL files in order:
   \`\`\`bash
   psql -d contact_crm -f 001_create_contacts_table.sql
   psql -d contact_crm -f 002_create_tags_table.sql
   # ... continue with all files in order
   \`\`\`

4. **Load Seed Data (Optional)**
   \`\`\`bash
   psql -d contact_crm -f 018_seed_data.sql
   \`\`\`

## Key Features

### Automatic Timestamps
All tables include `created_at` and `updated_at` timestamps with automatic updates via triggers.

### Full-Text Search
Full-text search indexes on contacts, deals, and activities for fast searching.

### Data Validation
Comprehensive check constraints for:
- Phone number format validation
- Email format validation
- Positive values for financial fields
- Logical date constraints

### Performance Optimization
- Strategic indexes for common query patterns
- Partial indexes for active records
- Composite indexes for multi-column queries

### Views and Functions
- `contact_summary` - Contact overview with activity stats
- `deal_pipeline` - Deal pipeline with contact info
- `activity_dashboard` - Activity overview with due dates
- `calculate_contact_score()` - Contact scoring function
- `get_contact_tags()` - Get contact tags as array

### Triggers
- Automatic `updated_at` timestamp updates
- Deal stage change logging
- Conversation statistics updates
- Activity overdue status updates

## Data Types and Constraints

### UUIDs
All primary keys use UUID with `gen_random_uuid()` for better distribution and security.

### Financial Fields
- `NUMERIC(15,2)` for currency values
- `NUMERIC(10,4)` for cost tracking with precision

### Text Fields
- `VARCHAR` with appropriate limits for structured data
- `TEXT` for unlimited content (notes, descriptions)
- `JSONB` for flexible metadata storage

### Arrays
- `TEXT[]` for tags, labels, and capabilities
- Indexed with GIN for efficient querying

## Relationships

### One-to-Many
- contacts → messages, calls, emails, activities, deals
- deals → deal_stage_history
- assistants → phone_numbers, vapi_calls

### Many-to-Many
- contacts ↔ tags (via contact_tags)
- deals ↔ tags (via deal_tags)

### Optional Relationships
- documents can belong to contacts, deals, or activities
- activities can be linked to deals
- phone_numbers can be assigned to assistants

## Indexes Strategy

### Primary Indexes
- All foreign keys are indexed
- Timestamp fields for chronological queries
- Status fields for filtering

### Composite Indexes
- Multi-column indexes for common query patterns
- Contact name + status combinations
- Date + status combinations

### Full-Text Indexes
- GIN indexes for text search across multiple fields
- English language configuration for stemming

### Partial Indexes
- Active records only (non-deleted, non-closed)
- Unread messages and pending activities

## Security Considerations

### Data Validation
- Email and phone format validation
- Positive value constraints for financial fields
- Enum constraints for status fields

### Referential Integrity
- Proper foreign key constraints
- CASCADE deletes where appropriate
- SET NULL for optional relationships

### Performance
- Efficient indexing strategy
- Optimized for common query patterns
- Minimal redundant data storage

## Maintenance

### Regular Tasks
- Analyze table statistics: `ANALYZE;`
- Vacuum for space reclamation: `VACUUM;`
- Reindex if needed: `REINDEX DATABASE contact_crm;`

### Monitoring
- Check index usage with `pg_stat_user_indexes`
- Monitor query performance with `pg_stat_statements`
- Track table sizes with `pg_size_pretty(pg_total_relation_size('table_name'))`

## Migration Notes

### From Mock Data
The schema is designed to accommodate the existing mock data structure with additional fields for real-world usage.

### Extensibility
- JSONB fields for custom metadata
- Flexible tag system for categorization
- Modular design for easy feature additions

### Integration Ready
- Designed for Supabase compatibility
- Row Level Security (RLS) ready
- Real-time subscription friendly

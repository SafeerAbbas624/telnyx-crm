# Multi-Pipeline Implementation Guide

## Overview
This CRM will support multiple business pipelines with complete data isolation:
1. **Private Lender** - Originating loans and private lending
2. **Real Estate Wholesaling** - Acquiring and wholesaling properties  
3. **Loan Officer Recruitment** - Direct outreach for recruiting loan officers

Each pipeline will have its own:
- Contacts
- Tasks/Activities
- Templates (SMS, Email, Task)
- Tags
- Deals
- Text Blasts & Automations
- Filter Presets
- Power Dialer Lists
- Task Types & Settings

## Database Architecture

### New Tables

#### 1. `pipelines`
Stores pipeline definitions
- `id` (UUID, PK)
- `name` (VARCHAR 255)
- `description` (TEXT)
- `color` (VARCHAR 50) - For UI theming
- `icon` (VARCHAR 50) - Icon name
- `is_active` (BOOLEAN)
- `is_default` (BOOLEAN)
- `display_order` (INTEGER)
- `created_at`, `updated_at`

#### 2. `user_pipeline_settings`
User-specific settings per pipeline (task types, custom fields, etc.)
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `pipeline_id` (UUID, FK → pipelines)
- `task_types` (TEXT[])
- `custom_settings` (JSONB)
- `created_at`, `updated_at`
- UNIQUE constraint on (user_id, pipeline_id)

#### 3. `user_active_pipeline`
Tracks which pipeline each user is currently viewing
- `id` (UUID, PK)
- `user_id` (UUID, FK → users, UNIQUE)
- `pipeline_id` (UUID, FK → pipelines)
- `updated_at`

### Modified Tables
Added `pipeline_id` (UUID, nullable, FK → pipelines) to:
- `contacts`
- `activities` (tasks, calls, meetings)
- `message_templates`
- `email_templates`
- `task_templates`
- `deals`
- `tags`
- `text_blasts`
- `text_automations`
- `filter_presets`
- `power_dialer_lists`

## Implementation Steps

### Phase 1: Database Migration ✅ (IN PROGRESS)
1. ✅ Create migration SQL file
2. ✅ Update Prisma schema with new models
3. ⏳ Complete adding pipeline_id to all models
4. ⏳ Run migration: `npx prisma migrate dev --name add_pipelines`
5. ⏳ Generate Prisma client: `npx prisma generate`

### Phase 2: Backend API Updates
1. Create pipeline management API endpoints:
   - `GET /api/pipelines` - List all pipelines
   - `POST /api/pipelines` - Create new pipeline
   - `PUT /api/pipelines/[id]` - Update pipeline
   - `DELETE /api/pipelines/[id]` - Delete pipeline
   - `GET /api/user/active-pipeline` - Get user's active pipeline
   - `PUT /api/user/active-pipeline` - Set user's active pipeline

2. Update existing API endpoints to filter by pipeline:
   - `/api/contacts` - Add pipeline_id filter
   - `/api/tasks` - Add pipeline_id filter
   - `/api/templates` - Add pipeline_id filter
   - `/api/tags` - Add pipeline_id filter
   - `/api/deals` - Add pipeline_id filter
   - All other data endpoints

3. Create middleware to inject active pipeline_id into requests

### Phase 3: Frontend Context & State Management
1. Create `PipelineContext` to store active pipeline
2. Create `usePipeline()` hook for components
3. Store active pipeline in localStorage for persistence
4. Update all API calls to include pipeline_id

### Phase 4: UI Components
1. **Pipeline Switcher Component** (Header/Sidebar)
   - Dropdown to switch between pipelines
   - Show current pipeline name & icon
   - Color-coded for visual distinction

2. **Pipeline Management Page** (Settings)
   - List all pipelines
   - Create/Edit/Delete pipelines
   - Set default pipeline
   - Configure pipeline-specific settings

3. **Pipeline-Specific Task Types**
   - Move task types from global UserSettings to UserPipelineSettings
   - Each pipeline has its own task types

### Phase 5: Data Migration
1. Assign existing data to default pipeline
2. Update script to migrate current contacts/tasks/templates

### Phase 6: Testing
1. Test data isolation between pipelines
2. Test pipeline switching
3. Test creating data in different pipelines
4. Test that switching pipelines shows correct data

## UI/UX Design

### Pipeline Switcher (Header)
```
┌─────────────────────────────────────────┐
│ [🏦 Private Lender ▼]  Contacts  Tasks │
└─────────────────────────────────────────┘
```

Clicking opens dropdown:
```
┌──────────────────────────────────┐
│ ✓ 🏦 Private Lender             │
│   🏠 Real Estate Wholesaling     │
│   👥 Loan Officer Recruitment    │
│   ─────────────────────────────  │
│   ⚙️  Manage Pipelines           │
└──────────────────────────────────┘
```

### Visual Distinction
- Each pipeline has a color theme
- Header/sidebar shows pipeline color
- Pipeline icon displayed throughout UI

## API Response Examples

### GET /api/user/active-pipeline
```json
{
  "id": "uuid",
  "name": "Private Lender",
  "color": "#10B981",
  "icon": "dollar-sign"
}
```

### GET /api/contacts (with pipeline filter)
```json
{
  "contacts": [...],
  "pagination": {...},
  "pipeline": {
    "id": "uuid",
    "name": "Private Lender"
  }
}
```

## Next Steps
1. Complete Prisma schema updates for remaining models
2. Run database migration
3. Create pipeline API endpoints
4. Create PipelineContext and hooks
5. Build Pipeline Switcher component
6. Update all data-fetching code to use active pipeline


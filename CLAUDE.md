# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

**Development:**
```bash
npm run dev              # Start dev server with hot reload on port 3000
```

**Production:**
```bash
npm run build            # Build for production
npm start                # Start production server (runs server.js)
```

**Database:**
```bash
npm run db:generate      # Generate Prisma client after schema changes
npm run db:push          # Push schema changes to database without migrations
npm run db:migrate       # Create and run a new migration
npm run db:studio        # Open Prisma Studio GUI for database inspection
```

**Code Quality:**
```bash
npm run lint             # Run Next.js ESLint
```

**Important:** The application uses a custom Node.js server (`server.js`) with Socket.IO for real-time features, not the standard Next.js dev server.

## High-Level Architecture

### Application Structure

This is an enterprise CRM system built with **Next.js 14 (App Router)** and runs on a **custom Node.js HTTP server** with Socket.IO for real-time features. The codebase manages multi-channel communication (SMS, voice calls, email), contact management, deal pipelines, and automated workflows.

**Key Architectural Decisions:**
- All pages use `export const dynamic = 'force-dynamic'` (no static generation)
- Custom server (`server.js`) enables Socket.IO alongside Next.js
- Three-tier caching: Redis (L1) → Elasticsearch (L2) → PostgreSQL (L3)
- Role-based access control with NextAuth sessions
- Background job processing with Bull queues on Redis

### Database Layer (Prisma + PostgreSQL)

**Core Models:**
- **Contact**: Central entity with 60+ fields including property data, financial estimates, multiple phones/emails, and JSON customFields
- **Deal**: Sales opportunities linked to contacts with pipeline stages
- **Pipeline/DealPipelineStage**: Customizable sales pipelines (default: "Sales Pipeline" and "Loan Processing")
- **Message/TelnyxMessage**: SMS communication with segment tracking
- **Call/TelnyxCall**: Voice call records with duration, cost, recordings
- **EmailMessage/EmailConversation**: Email with threading via Message-ID/In-Reply-To headers
- **Activity**: Tasks, calls, meetings, notes with due dates
- **User**: ADMIN and TEAM_USER roles with resource assignments
- **ContactAssignment**: Assigns contacts to team members
- **PowerDialer models**: PowerDialerRun, PowerDialerQueue, PowerDialerList, PowerDialerCall
- **Sequence models**: Automated follow-up sequences with enrollment tracking

**Performance Patterns:**
- Composite indexes on frequently filtered columns: `dealStatus + createdAt`, `city + state`, `phone1`, `email1`
- Soft deletes via `deletedAt` field on Contact
- Decimal types for financial precision (estValue, estEquity, lastSaleAmount)
- JSON storage for extensible customFields

### Authentication & Authorization

**NextAuth v4 Configuration (`lib/auth.ts`):**
- JWT session strategy with bcryptjs password hashing
- Session token includes: `id, email, name, role, status, adminId, assignedPhoneNumber, assignedEmailId`
- Middleware (`middleware.ts`) enforces route protection and redirects

**Role-Based Access:**
- **ADMIN**: Full access including `/billing`, `/import`, `/settings`, `/team-overview`
- **TEAM_USER**: Restricted to assigned contacts and resources
- Admin-only routes block TEAM_USER via middleware check: `token.role !== 'ADMIN'`

**API Route Pattern:**
```typescript
const session = await getServerSession(authOptions)
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// For team users, filter by assignments
if (session.user.role === 'TEAM_USER') {
  query.where.assignments = {
    some: { userId: session.user.id }
  }
}
```

### Real-Time Communication (Socket.IO + Redis Pub/Sub)

**Server Setup (`server.js`):**
- Custom HTTP server on port 3000 with Socket.IO
- CORS configured for `NEXTAUTH_URL`
- Transports: WebSocket (preferred) + polling fallback

**Room-Based Broadcasting:**
- User-specific: `socket.join('user:${userId}')`
- Account-wide: `socket.join('account:${accountId}')`

**Redis Pub/Sub:**
- Channel: `email:sync`
- Publisher emits after email sync completion
- Subscriber in `server.js` broadcasts to Socket.IO rooms
- Event types: `email:synced` (account-specific), `email:new` (global)

**Pattern for triggering real-time updates:**
```typescript
// In API route after email sync
const redisPublisher = new Redis(...)
redisPublisher.publish('email:sync', JSON.stringify({
  accountId: session.user.adminId,
  userId: session.user.id,
  type: 'manual'
}))
```

### External Integrations

**Telnyx (SMS & Voice):**
- SMS via `https://api.telnyx.com/v2/messages` with E.164 phone validation
- Voice calls via Telnyx Call Control API with WebRTC
- Webhooks: `/api/telnyx/webhooks/messages` (SMS), `/api/telnyx/webhooks/calls` (voice status)
- Cost tracking: TelnyxBilling records created per message/call
- Credentials: `TELNYX_API_KEY`, `TELNYX_V2_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_RTC_LOGIN`

**Power Dialer Engine (`lib/dialer/engine.ts`):**
- Multi-line concurrent calling (1-10 configurable)
- First-answer-wins logic for parallel attempts
- AMD (Answering Machine Detection) with configurable timeout
- Call duration limit: 10 minutes for cost control
- Ring timeout: 30 seconds
- Maps Telnyx call_control_id to PowerDialerRun for webhook routing

**Email (IMAP/SMTP via nodemailer + imap-simple):**
- Inbound: IMAP sync via Bull queue (`email-sync-queue.ts`) with 3 retry attempts
- Outbound: SMTP sending with template variable substitution
- Threading: Detects via Message-ID, In-Reply-To, References headers
- EmailAccount model stores per-user IMAP/SMTP credentials
- Sync broadcasts via Redis → Socket.IO to notify all team members

**Elasticsearch:**
- Full-text search on 500K+ contacts
- Custom analyzer: `contact_analyzer` with synonym mapping
- Fallback to Postgres if unavailable or for complex multi-filter queries
- Indexed fields: name, phone, email, address, notes

### State Management

**Zustand Stores (`lib/stores/`):**
- `useDealsStore`: Deal CRUD, pipeline management, stage movement
- `useLoanStore`: Loan-specific deal fields (LTV, borrower info, documents)
- `useTaskStore`: Task CRUD with filtering
- `useVapiStore`: Voice AI call state

**React Context (`lib/context/`):**
- `multi-call-context`: Concurrent call management (up to 3 simultaneous)
- `contacts-context`: Contact list caching and bulk operations
- `call-ui-context`, `sms-ui-context`, `email-ui-context`: UI state for communication channels
- `phone-number-context`: DID selection

### Background Jobs (Bull Queues)

**Queue Manager (`lib/jobs/queue-manager.ts`):**

| Job Type | Concurrency | Retries | Purpose |
|----------|------------|---------|---------|
| BULK_CONTACT_IMPORT | 2 | 3 | CSV import processing |
| ELASTICSEARCH_SYNC | 1 | 5 | Search index updates |
| BULK_EMAIL_SEND | 5 | 3 | Email campaigns |
| BULK_SMS_SEND | 10 | 3 | Text blasts |
| DATA_CLEANUP | 1 | 2 | Maintenance tasks |
| ANALYTICS_CALCULATION | 2 | 3 | Dashboard metrics |

**Email Sync Queue:**
- Dedicated Bull queue on Redis db:1
- Job types: `manual` (priority 1), `auto` (priority 10), `initial`
- Keeps last 100 completed, 200 failed jobs
- Exponential backoff on retries

**Cron Jobs:**
- `/api/cron/process-scheduled-messages` - Send queued SMS/emails
- `/api/cron/process-call-costs` - Telnyx CDR reconciliation
- `/api/cron/sync-power-dialer-lists` - Contact list synchronization
- `/api/cron/task-reminders` - Task notification delivery

### API Route Organization (231 Routes)

**Naming Conventions:**
- `/api/{resource}` - List/create operations
- `/api/{resource}/[id]` - Single resource CRUD
- `/api/{resource}/batch` - Batch operations
- `/api/admin/{resource}` - Admin-only endpoints
- `/api/team/{resource}` - Team member endpoints with assignment filtering
- `/api/telnyx/webhooks/*` - Telnyx incoming webhooks
- `/api/cron/*` - Scheduled job endpoints

**Query Pattern:**
- Pagination: `?page=1&limit=50` (default limit: 50)
- Search: `?search=keyword` (searches name, phone, email)
- Filters: `?filters={"dealStatus":"lead","city":"Miami"}`
- Sort: `?orderBy=createdAt&order=desc`

**Response Pattern:**
```typescript
// Success
{ data: [...], total: 100, page: 1, limit: 50 }

// Error
{ error: 'Error message' }
```

### Key Development Patterns

**1. Contact Queries with Multi-Tier Caching:**
```typescript
// Check Redis cache first
const cacheKey = `contacts:page:${page}:limit:${limit}:filters:${hash}`
let cached = await redis.get(cacheKey)

// If not cached, try Elasticsearch for simple queries
if (!cached && simpleQuery) {
  result = await elasticsearchClient.search(...)
}

// Fall back to Prisma for complex queries
if (!result) {
  result = await prisma.contact.findMany({
    where: { deletedAt: null, ...filters },
    include: { /* selective field loading */ }
  })
}
```

**2. Webhook Idempotency (Telnyx):**
```typescript
// Check if message already exists by Telnyx ID
const existing = await prisma.telnyxMessage.findUnique({
  where: { messageId: payload.data.id }
})
if (existing) {
  return NextResponse.json({ received: true })
}
```

**3. Contact Assignment Filtering:**
```typescript
// In API routes for TEAM_USER role
if (session.user.role === 'TEAM_USER') {
  query.where.assignments = {
    some: { userId: session.user.id }
  }
}
```

**4. Soft Delete Queries:**
```typescript
// Always exclude soft-deleted contacts
await prisma.contact.findMany({
  where: { deletedAt: null, ...otherFilters }
})

// To restore
await prisma.contact.update({
  where: { id },
  data: { deletedAt: null }
})
```

**5. Phone Number Validation:**
```typescript
// E.164 format enforcement
function formatPhoneToE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`
}
```

**6. Template Variable Substitution:**
```typescript
// Email/SMS templates
const message = template.replace(/{{propertyAddress}}/g, contact.propertyAddress)
  .replace(/{{borrowerName}}/g, contact.fullName)
  .replace(/{{firstName}}/g, contact.firstName)
```

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Session encryption key
- `NEXTAUTH_URL` - Auth callback URL (e.g., `http://localhost:3000`)
- `TELNYX_API_KEY`, `TELNYX_V2_KEY` - Telnyx API credentials
- `TELNYX_CONNECTION_ID` - SIP connection ID
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis for cache/queue

**Optional:**
- `ELASTICSEARCH_URL` - Search engine endpoint
- `TELNYX_RTC_LOGIN`, `TELNYX_RTC_SIP_DOMAIN` - WebRTC credentials
- `NEXT_PUBLIC_APP_URL` - Frontend public URL
- `WEBHOOK_BASE_URL` - Production webhook base URL

### Import Patterns

**Path Aliases:**
- `@/` maps to project root (configured in `tsconfig.json`)
- Example: `import { prisma } from '@/lib/db'`

**Common Imports:**
```typescript
import { prisma } from '@/lib/db'                    // Prisma client
import { getServerSession } from 'next-auth'         // Session in API routes
import { authOptions } from '@/lib/auth'             // Auth configuration
import { NextResponse } from 'next/server'           // API responses
import { z } from 'zod'                               // Schema validation
```

### Code Style Conventions

- TypeScript strict mode enabled
- Prisma model names: PascalCase (e.g., `ContactTag`)
- Database table names: snake_case (e.g., `contact_tags`)
- API route handlers: Named export `GET`, `POST`, `PUT`, `DELETE`
- Client components: `'use client'` directive at top
- Server components: Default (no directive needed)
- Enums: Database enums via Prisma schema (e.g., `DealStatus`, `UserRole`)

### Testing

No test framework is currently configured. Tests would need to be set up before adding test coverage.

### Deployment Notes

- The app runs on a custom Node.js server, not Vercel's serverless functions
- Socket.IO requires a persistent server instance (not compatible with serverless)
- Redis is required for job queues and pub/sub
- PostgreSQL database must be accessible from the server
- Telnyx webhooks must reach a public URL
- Recommended: VPS deployment (DigitalOcean, Railway) or containerized deployment

### Common Gotchas

1. **Always exclude soft-deleted contacts**: Add `deletedAt: null` to Contact queries
2. **Team user filtering**: Check session role and filter by assignments
3. **Phone format**: Use E.164 format (+1XXXXXXXXXX) for Telnyx API
4. **WebSocket connection**: Ensure client joins appropriate rooms on Socket.IO connect
5. **Database migrations**: Use `npm run db:push` for schema sync in dev, `npm run db:migrate` for production
6. **Prisma client**: Run `npm run db:generate` after schema changes
7. **Redis connection**: Bull queues use db:1, avoid conflicts with cache on db:0
8. **Webhook signatures**: Validate Telnyx webhook signatures in production
9. **Custom server**: Changes to `server.js` require full restart (not hot-reloaded)
10. **Dynamic rendering**: All pages are dynamic, no static generation

### Key Files & Directories

- `/server.js` - Custom HTTP server with Socket.IO
- `/middleware.ts` - Route protection and role-based access control
- `/lib/auth.ts` - NextAuth configuration
- `/lib/db.ts` - Prisma client singleton
- `/lib/dialer/engine.ts` - Power dialer core logic
- `/lib/jobs/queue-manager.ts` - Bull queue configuration
- `/lib/stores/` - Zustand state management
- `/lib/context/` - React context providers
- `/prisma/schema.prisma` - Database schema (60+ models)
- `/app/api/` - 231 API route handlers
- `/components/` - React UI components

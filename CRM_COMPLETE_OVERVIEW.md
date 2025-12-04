# 🎯 Adler Capital CRM - Complete System Overview

## 📋 Executive Summary
A comprehensive, enterprise-grade CRM system built with **Next.js 14**, **React 18**, **TypeScript**, **PostgreSQL**, and **Telnyx integration**. Designed for real estate and lending professionals with advanced communication, deal management, and loan processing capabilities.

---

## 🏗️ SYSTEM ARCHITECTURE

### **Frontend Stack**
- **Framework**: Next.js 14 with React 18
- **Language**: TypeScript
- **UI Components**: Radix UI primitives
- **Styling**: Tailwind CSS
- **State Management**: Zustand (with localStorage persistence)
- **Forms**: React Hook Form with Zod validation
- **Real-time**: WebSocket (Socket.io)
- **Rich Text**: TipTap editor for emails

### **Backend Stack**
- **API**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Email**: Nodemailer (SMTP/IMAP)
- **SMS/Voice**: Telnyx integration
- **Job Queue**: Bull with Redis
- **Search**: Elasticsearch (optional)
- **File Storage**: Local `/public/uploads`

### **Infrastructure**
- **Process Manager**: PM2 (ecosystem.config.js)
- **Port**: 3000
- **Environment**: Production-ready with clustering

---

## 📊 DATABASE SCHEMA (40+ Tables)

### **Core Contact Management**
- `contacts` - Main contact records with property details
- `contact_properties` - Multiple properties per contact
- `contact_tags` - Contact categorization
- `contact_assignments` - User-to-contact assignments

### **Communication**
- `messages` - SMS/MMS history
- `telnyx_messages` - Telnyx SMS tracking
- `telnyx_calls` - Call logs and recordings
- `conversations` - SMS conversation threads
- `email_messages` - Email storage with threading
- `email_conversations` - Email thread management
- `email_accounts` - Email account configurations

### **Business Operations**
- `deals` - Sales pipeline deals
- `deal_tags` - Deal categorization
- `deal_stage_history` - Deal progression tracking
- `activities` - Tasks, meetings, calls, notes
- `activity_tags` - Activity categorization

### **Loan Processing**
- `loans` - Loan records (via Zustand store)
- `documents` - File storage and versioning
- `email_templates` - Reusable email templates
- `email_blasts` - Bulk email campaigns

### **Communication Automation**
- `text_blasts` - SMS bulk campaigns
- `text_automations` - Recurring SMS sequences
- `message_templates` - SMS template library

### **Power Dialer**
- `power_dialer_sessions` - Dialing sessions
- `power_dialer_queue` - Contact queue
- `power_dialer_calls` - Call tracking

### **Billing & Tracking**
- `telnyx_billing` - SMS/call costs
- `telnyx_phone_numbers` - Phone number inventory
- `telnyx_cdr_reconcile_jobs` - Call detail reconciliation

### **User Management**
- `users` - User accounts with roles (ADMIN, TEAM_USER)
- `sessions` - Session management
- `filter_presets` - Saved filter configurations

---

## 🎨 MAIN PAGES & FEATURES

### **Dashboard Tab** (`/`)
- System overview with KPIs
- Recent activities
- Quick stats (contacts, deals, calls, emails)
- Activity timeline

### **Contacts Tab** (`/contacts`)
- Contact list with advanced filtering
- Contact details page (`/contacts/[id]`)
- Add/edit contact dialogs
- Bulk tag operations
- Contact timeline (calls, emails, messages, activities)
- Contact notes and history
- Property management (multiple properties per contact)
- DNC (Do Not Call) tracking

### **Deals Tab**
- Sales pipeline visualization
- Deal stages (lead → qualified → proposal → negotiation → closed)
- Deal creation and editing
- Deal value and probability tracking
- Deal stage history
- Custom fields support
- Multiple pipelines

### **Loan Co-Pilot Tab**
- Loan management interface
- Loan details (borrower, property, DSCR, LTV)
- Document management (upload, preview, download)
- Task management for loans
- Notes and timeline
- Email tracking
- Bulk email sending
- AI-powered document requirements

### **Sequences Tab**
- Email/SMS sequence builder
- Automation workflows
- Trigger-based messaging

### **Text Center Tab** (SMS)
- SMS conversations (Gmail-style)
- Text blast campaigns
- Message templates
- Text automation
- Sender number selection
- Contact filtering
- Real-time message delivery

### **Email Center Tab**
- Email account setup (SMTP/IMAP)
- Gmail-style conversation view
- Email threading
- Rich text editor
- Email templates
- Email blasts
- Email tracking (opens, clicks)
- Auto-sync every 30 seconds

### **Calls Tab**
- Call history and logs
- Manual dialing
- Power dialer (concurrent calling)
- Call recording
- Call cost tracking
- Call duration and status

### **Billing Tab**
- Usage statistics
- SMS costs
- Call costs
- Phone number costs
- Monthly billing summary
- Cost breakdown by contact

### **Import Tab** (`/import`)
- CSV file upload
- Field mapping
- Bulk tag assignment
- Import history
- Duplicate detection
- Validation

### **Team Tab**
- Team member management
- Contact assignment
- Email account assignment
- Phone number assignment
- Team activity overview
- Team performance metrics

### **Settings Tab**
- Profile settings
- Team management
- Email account configuration
- Phone number management
- Filter presets

---

## 🔌 API ENDPOINTS (50+)

### **Contacts**
- `GET/POST /api/contacts` - List/create contacts
- `GET/PUT/DELETE /api/contacts/[id]` - Contact CRUD
- `GET /api/contacts/filter-options` - Filter options
- `POST /api/contacts/bulk-tags` - Bulk tag operations
- `GET /api/contacts/lookup-by-number` - Phone lookup

### **Email**
- `GET/POST /api/email/accounts` - Email account management
- `GET/POST /api/email/messages` - Email messages
- `GET/POST /api/email/conversations` - Email threads
- `POST /api/email/send` - Send email
- `POST /api/email/blasts` - Email campaigns
- `GET/POST /api/email/templates` - Email templates
- `POST /api/email/sync` - Manual sync

### **SMS/Telnyx**
- `POST /api/telnyx/sms` - Send SMS
- `GET/POST /api/telnyx/calls` - Call management
- `GET /api/telnyx/numbers` - Phone numbers
- `GET /api/telnyx/billing` - Billing records
- `POST /api/telnyx/webhooks` - Webhook handlers

### **Deals**
- `GET/POST /api/deals` - Deal management
- `GET/POST /api/deals/[id]` - Deal CRUD

### **Activities**
- `GET/POST /api/activities` - Activity management
- `GET/POST /api/activities/[id]` - Activity CRUD

### **Power Dialer**
- `POST /api/power-dialer/session` - Start session
- `POST /api/power-dialer/queue` - Manage queue
- `POST /api/power-dialer/calls` - Call tracking

### **Admin**
- `GET/POST /api/admin/contacts` - Contact management
- `GET/POST /api/admin/team-users` - Team management
- `POST /api/admin/assign-contacts` - Assign contacts

---

## 🔐 Authentication & Authorization

- **NextAuth.js** with email/password
- **Role-based access**: ADMIN, TEAM_USER
- **Admin features**: Full system access, team management
- **Team user features**: Assigned contacts, assigned email, assigned phone
- **Session management**: Secure token-based sessions

---

## 🚀 KEY FEATURES

✅ **Contact Management** - Centralized contact database with properties
✅ **SMS/Text Blasts** - Bulk SMS with templates and automation
✅ **Email Integration** - Full SMTP/IMAP support for any provider
✅ **Voice Calls** - Telnyx-powered calling with recording
✅ **Power Dialer** - Concurrent calling with queue management
✅ **Deal Pipeline** - Sales pipeline with stages and tracking
✅ **Loan Processing** - Specialized loan management module
✅ **Activity Tracking** - Tasks, meetings, calls, notes
✅ **Email Campaigns** - Bulk email with templates
✅ **Billing & Analytics** - Cost tracking and usage metrics
✅ **Team Management** - Multi-user with role-based access
✅ **Advanced Filtering** - Complex contact/deal filtering
✅ **Import/Export** - CSV import with validation
✅ **Real-time Updates** - WebSocket for live notifications

---

## 📁 PROJECT STRUCTURE

```
/var/www/adlercapitalcrm.com/
├── app/                    # Next.js app directory
│   ├── api/               # API routes (50+ endpoints)
│   ├── auth/              # Authentication pages
│   ├── contacts/          # Contact pages
│   ├── dashboard/         # Dashboard page
│   ├── import/            # Import page
│   └── layout.tsx         # Root layout
├── components/            # React components (150+)
│   ├── email/            # Email components
│   ├── contacts/         # Contact components
│   ├── deals/            # Deal components
│   ├── calls/            # Call components
│   ├── text/             # SMS components
│   ├── loan-copilot/     # Loan components
│   └── ui/               # Radix UI components
├── lib/                   # Utilities and helpers
│   ├── api.ts            # API client
│   ├── db.ts             # Database connection
│   ├── auth.ts           # Auth utilities
│   ├── email-threading.ts # Email logic
│   ├── power-dialer/     # Dialer engine
│   └── context/          # React contexts
├── prisma/               # Database schema
│   └── schema.prisma     # Prisma schema
├── public/               # Static assets
│   └── uploads/          # File storage
├── types/                # TypeScript types
├── hooks/                # Custom React hooks
├── styles/               # Global styles
└── package.json          # Dependencies
```

---

## 🔄 Data Flow

1. **User Action** → React Component
2. **Component** → API Route (`/api/*`)
3. **API Route** → Prisma ORM
4. **Prisma** → PostgreSQL Database
5. **Response** → Component State (Zustand)
6. **UI Update** → Real-time via WebSocket

---

## 🎯 Next Steps for Understanding

1. **Explore Pages**: Visit each tab to understand workflows
2. **Review Database**: Check `prisma/schema.prisma` for data model
3. **API Documentation**: Review `/app/api` for endpoint details
4. **Component Structure**: Browse `/components` for UI logic
5. **Configuration**: Check `.env` for integrations

---

**Last Updated**: 2025-11-06
**Version**: Enterprise Edition
**Status**: Production Ready


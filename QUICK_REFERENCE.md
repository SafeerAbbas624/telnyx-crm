# ⚡ Adler Capital CRM - Quick Reference Guide

## 🎯 MAIN TABS & THEIR PURPOSE

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Dashboard** | System overview | KPIs, recent activities, quick stats |
| **Contacts** | Contact management | CRUD, filtering, tagging, timeline |
| **Deals** | Sales pipeline | Kanban board, stages, value tracking |
| **Loan Co-Pilot** | Loan processing | Documents, tasks, notes, AI assistant |
| **Sequences** | Automation | Email/SMS sequences, triggers |
| **Text Center** | SMS management | Conversations, blasts, automation |
| **Email Center** | Email management | Conversations, blasts, templates |
| **Calls** | Voice management | Manual dialing, power dialer |
| **Billing** | Cost tracking | SMS costs, call costs, usage |
| **Import** | Bulk import | CSV upload, field mapping |
| **Team** | Team management | Members, assignments, resources |
| **Settings** | Configuration | Profile, email accounts, phone numbers |

---

## 📁 KEY FILE LOCATIONS

### Pages
- Dashboard: `app/page.tsx` or `app/dashboard/page.tsx`
- Contacts: `app/contacts/[id]/page.tsx`
- Import: `app/import/page.tsx`
- Auth: `app/auth/signin/page.tsx`, `app/auth/signup/page.tsx`

### Components
- Email: `components/email/email-center.tsx`
- SMS: `components/text/text-center.tsx`
- Calls: `components/calls/calls-center.tsx`
- Deals: `components/deals/deals-pipeline.tsx`
- Loans: `components/loan-copilot/loan-copilot.tsx`
- Contacts: `components/contacts/contacts-redesign.tsx`

### API Routes
- Contacts: `app/api/contacts/route.ts`
- Email: `app/api/email/*`
- SMS: `app/api/telnyx/sms`
- Calls: `app/api/telnyx/calls`
- Deals: `app/api/deals/route.ts`

### Database
- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`

### State Management
- Deals: `useDealsStore.ts`
- Loans: `useLoanStore.ts`
- Tasks: `useTaskStore.ts`

---

## 🔄 COMMON WORKFLOWS

### Add a New Contact
1. Click "Add Contact" button
2. Fill in contact details
3. Click "Save"
4. Contact appears in list

### Send SMS
1. Go to Text Center
2. Select conversation or create new
3. Type message
4. Click "Send"
5. Message tracked in real-time

### Send Email
1. Go to Email Center
2. Click "New Email"
3. Select recipient
4. Compose message
5. Click "Send"
6. Email tracked (opens, clicks)

### Create Deal
1. Go to Deals tab
2. Click "New Deal"
3. Select contact
4. Enter deal details
5. Click "Create"
6. Drag to move between stages

### Import Contacts
1. Go to Import tab
2. Upload CSV file
3. Map fields
4. Add bulk tags (optional)
5. Click "Import"
6. View import history

### Start Power Dialer
1. Go to Calls tab
2. Click "Power Dialer"
3. Select contacts
4. Choose sender numbers
5. Click "Start"
6. Monitor calls in real-time

---

## 🔑 KEY CONCEPTS

### Contact Properties
- A contact can have **multiple properties**
- Each property stored separately in `contact_properties` table
- When importing: if phone+name match but address differs → add new property

### Email Threading
- Emails grouped by `thread_id`
- Replies linked via `in_reply_to` and `references`
- Conversations show all related emails

### Deal Stages
- **lead** → **qualified** → **proposal** → **negotiation** → **closed_won/closed_lost**
- Each stage change tracked in `deal_stage_history`
- Probability and value can change per stage

### Activities
- Types: call, meeting, email, text, task, note, follow_up, appointment, demo
- Status: planned, in_progress, completed, cancelled, overdue
- Priority: low, medium, high, urgent

### Power Dialer
- Concurrent lines: number of simultaneous calls
- Queue: contacts to call
- Retry: automatic retry on no answer (max 3 attempts)
- Statistics: total calls, answered, no answer, talk time

---

## 🛠️ COMMON TASKS

### Find a Contact
1. Go to Contacts tab
2. Use search bar or filters
3. Click contact to view details

### Filter Contacts
1. Click "Filters" button
2. Select filter criteria
3. Results update automatically
4. Click "Clear All" to reset

### Tag Contacts
1. Select contacts (checkbox)
2. Click "Bulk Tag"
3. Choose tags
4. Click "Apply"

### Assign Contact to Team Member
1. Go to Team tab
2. Select team member
3. Click "Assign Contacts"
4. Select contacts
5. Click "Assign"

### Create Email Template
1. Go to Email Center
2. Click "Templates"
3. Click "New Template"
4. Enter subject and content
5. Click "Save"

### Create SMS Template
1. Go to Text Center
2. Click "Templates"
3. Click "New Template"
4. Enter message
5. Click "Save"

### View Call Recording
1. Go to Calls tab
2. Find call in history
3. Click call to view details
4. Click "Play Recording" if available

### Check Billing
1. Go to Billing tab
2. Select date range
3. View costs by type (SMS, calls, numbers)
4. Download report (if available)

---

## 📊 DATABASE QUICK LOOKUP

### Find Contact's Messages
```
SELECT * FROM messages WHERE contact_id = 'contact-uuid'
ORDER BY created_at DESC
```

### Find Contact's Emails
```
SELECT * FROM email_messages WHERE contact_id = 'contact-uuid'
ORDER BY created_at DESC
```

### Find Contact's Calls
```
SELECT * FROM telnyx_calls WHERE contact_id = 'contact-uuid'
ORDER BY created_at DESC
```

### Find Contact's Activities
```
SELECT * FROM activities WHERE contact_id = 'contact-uuid'
ORDER BY created_at DESC
```

### Find Contact's Deals
```
SELECT * FROM deals WHERE contact_id = 'contact-uuid'
ORDER BY created_at DESC
```

### Calculate SMS Costs
```
SELECT SUM(cost) FROM telnyx_messages 
WHERE created_at >= '2025-01-01'
```

### Calculate Call Costs
```
SELECT SUM(cost) FROM telnyx_calls 
WHERE created_at >= '2025-01-01'
```

---

## 🔐 USER ROLES

### Admin
- ✅ Full system access
- ✅ Create/manage team members
- ✅ Assign resources
- ✅ View all contacts/deals/emails
- ✅ Access billing
- ✅ Configure settings

### Team User
- ✅ View assigned contacts only
- ✅ Use assigned email account
- ✅ Use assigned phone number
- ✅ Create activities
- ✅ Send messages/emails
- ✅ View personal dashboard

---

## 🚨 TROUBLESHOOTING

### Email Not Syncing
1. Check email account credentials
2. Verify IMAP is enabled
3. Check firewall/port access
4. Restart email sync

### SMS Not Sending
1. Verify Telnyx API key
2. Check phone number is active
3. Verify contact has valid phone
4. Check Telnyx balance

### Calls Not Working
1. Check WebRTC connection
2. Verify microphone permissions
3. Check Telnyx phone numbers
4. Restart browser

### Slow Performance
1. Clear browser cache
2. Check database indexes
3. Reduce filter complexity
4. Contact support

---

## 📞 SUPPORT RESOURCES

- **Documentation**: See CRM_COMPLETE_OVERVIEW.md
- **Workflows**: See FEATURE_WORKFLOWS.md
- **Tech Stack**: See TECHNOLOGY_STACK.md
- **Database**: See prisma/schema.prisma
- **API**: See app/api/ directory

---

**Last Updated**: 2025-11-06
**Version**: Enterprise Edition


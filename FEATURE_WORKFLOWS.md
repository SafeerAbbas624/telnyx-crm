# 🔄 Adler Capital CRM - Feature Workflows

## 1️⃣ CONTACT MANAGEMENT WORKFLOW

### Creating a Contact
```
User → Add Contact Dialog → Form Validation → API POST /api/contacts
→ Prisma Create → PostgreSQL INSERT → Response → UI Update
```

### Importing Contacts (CSV)
```
User → Import Page → Upload CSV → Field Mapping → Validation
→ API POST /api/import → Bulk Insert → Duplicate Detection
→ Tag Assignment → Import History → Success Toast
```

### Contact Details View
```
User → Click Contact → Fetch /api/contacts/[id] → Load Details
→ Display Tabs: Timeline, Notes, Activities, Calls, Messages, Emails
→ Real-time Updates via WebSocket
```

### Bulk Tag Operations
```
User → Select Contacts → Bulk Tag Dialog → Choose Tags
→ API POST /api/contacts/bulk-tags → Update contact_tags table
→ Refresh UI → Success Notification
```

---

## 2️⃣ EMAIL CENTER WORKFLOW

### Setting Up Email Account
```
User → Email Center → Settings Tab → Add Account
→ Enter SMTP/IMAP Credentials → Test Connection
→ Encrypt Password → Save to email_accounts table
→ Start Auto-sync (every 30 seconds)
```

### Sending Email
```
User → New Email Modal → Select Contact → Compose Message
→ Rich Text Editor (TipTap) → Add Attachments
→ API POST /api/email/send → Nodemailer SMTP
→ Save to email_messages table → Update conversation
→ Track open/click events
```

### Email Blast Campaign
```
User → Email Blast Tab → Select Recipients → Choose Template
→ Compose Subject/Body → Set Delay Between Emails
→ API POST /api/email/blasts → Create blast record
→ Background Job: Send emails with delay
→ Track delivery status → Update statistics
```

### Email Sync
```
Background Job (every 30s) → IMAP Connection → Fetch New Emails
→ Parse Headers & Body → Create email_messages records
→ Thread Emails (by Message-ID) → Update conversations
→ Notify Frontend via WebSocket
```

---

## 3️⃣ SMS/TEXT CENTER WORKFLOW

### Sending Single SMS
```
User → Text Conversation → Type Message → Send
→ API POST /api/telnyx/sms → Telnyx API
→ Create telnyx_messages record → Track status
→ Webhook: Update status (sent → delivered)
→ Real-time UI update
```

### Text Blast Campaign
```
User → Text Blast Tab → Select Contacts (with filters)
→ Choose/Create Template → Set Sender Number & Delay
→ API POST /api/text-blast → Create text_blasts record
→ Background Job: Process queue with delay
→ Send via Telnyx → Track delivery
→ Update statistics in real-time
```

### Text Automation (Recurring)
```
User → Text Automation → Set Message & Schedule
→ Choose Contacts & Filters → Set Loop Delay (days/weeks)
→ API POST /api/text/automations → Create automation record
→ Cron Job: Check next_run_at → Send messages
→ Update current_cycle → Schedule next run
→ Continue until completed or stopped
```

---

## 4️⃣ POWER DIALER WORKFLOW

### Starting Power Dialer Session
```
User → Calls Tab → Power Dialer → Select Contacts
→ Choose Sender Numbers → Set Concurrent Lines
→ API POST /api/power-dialer/session → Create session
→ Load contacts into power_dialer_queue
→ Start dialing engine
```

### Dialing Process
```
Engine → Check Queue (PENDING items) → Get Contact Phone
→ Select From Number (round-robin) → Initiate WebRTC Call
→ Telnyx API → Ring Contact → Wait for Answer
→ If Answered: Update queue item (CONTACTED) → Track talk time
→ If No Answer: Increment attempt count → Retry later
→ If Max Attempts: Mark FAILED
```

### Call Completion
```
Call Ends → Update power_dialer_calls record
→ Calculate duration → Log to telnyx_calls
→ Update session statistics
→ Create activity record
→ Move to next contact in queue
```

---

## 5️⃣ DEAL PIPELINE WORKFLOW

### Creating a Deal
```
User → Deals Tab → New Deal Dialog → Select Contact
→ Enter Deal Details (name, value, stage, probability)
→ API POST /api/deals → Create deal record
→ Initialize stage history → Set created_at
→ Display in pipeline
```

### Moving Deal Between Stages
```
User → Drag Deal Card → Drop on New Stage
→ API PUT /api/deals/[id] → Update stage
→ Create deal_stage_history record (old_stage → new_stage)
→ Update deal value/probability if changed
→ Recalculate pipeline statistics
→ Update UI
```

### Deal Analytics
```
System → Calculate:
- Total Deals Count
- Total Pipeline Value
- Weighted Value (value × probability/100)
- Average Deal Size
- Stage Distribution
→ Display in Dashboard & Deals Tab
```

---

## 6️⃣ LOAN CO-PILOT WORKFLOW

### Creating a Loan
```
User → Loan Co-Pilot → New Loan Dialog
→ Enter Borrower Info, Property Details, Loan Terms
→ API POST /api/loans → Create loan (Zustand store)
→ Add to loan list
```

### Managing Loan Documents
```
User → Loan Details → Documents Tab → Upload File
→ API POST /api/loans/documents/upload
→ Save to /public/uploads/loans/[loanId]/
→ Create document record
→ Display in document list
→ Preview/Download functionality
```

### Sending Loan Emails
```
User → Loan Email Tab → Compose Email
→ Select Recipients → Choose Template
→ API POST /api/loans/send-email → Nodemailer
→ Track email status
→ Log to email_messages table
→ Update conversation
```

### AI Document Requirements
```
System → Analyze Loan Type & Stage
→ Generate Required Documents List (from loanAIAssistant.ts)
→ Check uploaded documents
→ Highlight missing documents
→ Suggest next steps
```

---

## 7️⃣ ACTIVITY MANAGEMENT WORKFLOW

### Creating Activity
```
User → Add Activity Dialog → Select Type (call, meeting, task, note)
→ Enter Details (title, description, due date, priority)
→ Assign to User → Add Tags
→ API POST /api/activities → Create activity record
→ Set status: planned → in_progress → completed
```

### Activity Timeline
```
System → Query activities for contact
→ Sort by created_at DESC
→ Display chronologically
→ Show: Calls, Emails, Messages, Tasks, Notes
→ Link to related records
→ Allow inline editing
```

### Task Filtering
```
User → Activities Tab → Select Time Filter
→ Overdue & Today → Query due_date < today
→ Next 7 Days → Query due_date between today and +7 days
→ Next Month → Query due_date between today and +30 days
→ All Time → No date filter
→ Display filtered tasks
```

---

## 8️⃣ BILLING & COST TRACKING

### SMS Cost Tracking
```
Telnyx Webhook → SMS Delivered → Extract cost
→ Create telnyx_billing record (record_type: sms)
→ Update telnyx_messages.cost
→ Aggregate in Billing Dashboard
```

### Call Cost Tracking
```
Telnyx Webhook → Call Ended → Extract duration & cost
→ Create telnyx_billing record (record_type: call)
→ Update telnyx_calls.cost
→ Calculate monthly total
→ Display in Billing Tab
```

### Billing Dashboard
```
System → Query telnyx_billing for date range
→ Group by record_type (sms, call, number_rental)
→ Calculate totals
→ Display charts & statistics
→ Show cost breakdown by contact
```

---

## 9️⃣ TEAM MANAGEMENT WORKFLOW

### Adding Team Member
```
Admin → Settings → Team Management → Add User
→ Enter Email, Name, Role
→ API POST /api/admin/team-users → Create user
→ Generate temporary password
→ Send invitation email
```

### Assigning Resources
```
Admin → Team Overview → Select User
→ Assign Contacts → API POST /api/admin/assign-contacts
→ Assign Email Account → Update user.assigned_email_id
→ Assign Phone Number → Update user.assigned_phone_number
→ Team member now sees only assigned resources
```

### Team Dashboard
```
Team User → Team Dashboard → View:
- Assigned Contacts
- Assigned Email Conversations
- Assigned SMS Conversations
- Assigned Calls
- Personal Activities
→ All filtered by assignment
```

---

## 🔟 REAL-TIME UPDATES

### WebSocket Connection
```
Frontend → Connect to Socket.io Server
→ Join room: user-[userId]
→ Listen for events:
  - new_message
  - email_received
  - call_incoming
  - activity_created
  - contact_updated
→ Update UI in real-time
```

### Event Broadcasting
```
Backend Event → Emit to Socket.io
→ Broadcast to relevant user rooms
→ Frontend receives → Update state
→ UI re-renders automatically
```

---

**Last Updated**: 2025-11-06


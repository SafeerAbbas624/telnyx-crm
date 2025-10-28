# Deals & Loan Co-Pilot Module - Complete Technical Workflow

## Overview
The Deals and Loan Co-Pilot modules are tightly integrated to provide a seamless experience for managing both general sales deals and specialized DSCR loan processing. They share a unified data layer where loans are stored as Deals with additional `loanData` fields, ensuring bidirectional synchronization.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Model & Storage](#data-model--storage)
3. [Frontend Components](#frontend-components)
4. [State Management (Stores)](#state-management-stores)
5. [Complete Workflow - Deals Module](#complete-workflow---deals-module)
6. [Complete Workflow - Loan Co-Pilot Module](#complete-workflow---loan-co-pilot-module)
7. [Synchronization Between Deals & Loans](#synchronization-between-deals--loans)
8. [Task Management Integration](#task-management-integration)
9. [Document Management](#document-management)
10. [AI Assistant Integration](#ai-assistant-integration)
11. [API & Data Flow](#api--data-flow)
12. [Database Schema](#database-schema)
13. [File Reference](#file-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
├─────────────────────────────────────────────────────────────────┤
│  DealsModule (/deals)          LoanProcessingModule (/loans)    │
│  - Pipeline board view         - Loan list sidebar              │
│  - Kanban-style stages         - Detailed loan view             │
│  - Deal cards                  - Multi-tab interface            │
│  - Task management             - Document management            │
│                                - Contact management              │
│                                - AI Assistant                    │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      STATE MANAGEMENT LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  useDealsStore                 useLoanStore                      │
│  - Unified Deal storage        - Loan-specific logic            │
│  - Pipeline management         - Document management            │
│  - Stage management            - Contact management             │
│  - Task operations             - Email templates                │
│                                - Notes management                │
│                                                                  │
│  useTaskStore                  useContactStore                  │
│  - Task CRUD operations        - Contact information            │
│  - Task filtering              - Contact relationships          │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE                          │
├─────────────────────────────────────────────────────────────────┤
│  LocalStorage (Current Implementation)                          │
│                                                                 │                                       │
│  - deals table                                                  │
│  - pipelines table                                              │
│  - loan_documents table                                         │
│  - loan_contacts table                                          │
│  - loan_notes table                                             │
│  - tasks table                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model & Storage

### Core Data Structures

#### 1. Deal Entity (Primary)
**File:** `/types/deals.ts`

```typescript
interface Deal {
  id: string;                    // Unique identifier
  title: string;                 // Deal title
  value: number;                 // Deal monetary value
  contactId: string;             // Reference to contact
  contactName: string;           // Contact name (denormalized)
  stage: string;                 // Current pipeline stage ID
  probability: number;           // Win probability (0-100)
  expectedCloseDate: string;     // Target close date
  notes: string;                 // General notes
  tasks: DealTask[];             // Embedded tasks array
  createdAt: string;             // Creation timestamp
  updatedAt: string;             // Last update timestamp
  assignedTo?: string;           // Assigned user ID
  pipelineId?: string;           // Pipeline reference
  archived?: boolean;            // Archive status
  
  // Loan-specific extension
  loanData?: {
    borrowerEmail: string;
    borrowerPhone: string;
    borrowingEntity?: string;
    borrowerPrimaryResidence?: string;
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    propertyZip: string;
    loanAmount: number;
    propertyValue: number;
    ltv: number;                 // Loan-to-Value ratio
    loanType: 'Purchase' | 'Refinance' | 'Cash Out' | 'HELOC';
    interestOnly?: boolean;
    prepayPeriod?: '1 Year' | '2 Year' | '3 Year' | '5 Year' | 'None';
    lender: string;
    propertyType?: string;
    occupancyType?: string;
    monthlyRent?: number;
    marketRent?: number;
    interestRate?: number;
    annualTaxes?: number;
    annualInsurance?: number;
    annualHOA?: number;
    monthlyManagementFee?: number;
    dscr?: number;               // Debt Service Coverage Ratio
  };
}
```

#### 2. Pipeline Entity
**File:** `/types/deals.ts`

```typescript
interface Pipeline {
  id: string;                    // Unique identifier
  name: string;                  // Pipeline name
  description?: string;          // Pipeline description
  stages: PipelineStage[];       // Pipeline stages
  createdAt: string;             // Creation timestamp
  isDefault: boolean;            // Default pipeline flag
  isLoanPipeline?: boolean;      // Shows in Loan Co-Pilot when true
}

interface PipelineStage {
  id: string;                    // Stage identifier
  name: string;                  // Stage display name
  order: number;                 // Stage order (0-indexed)
  color: string;                 // Stage color (hex)
}
```

#### 3. Loan Entity (Virtual - Derived from Deal)
**File:** `/types/loans.ts`

```typescript
interface Loan {
  id: string;                    // Same as Deal.id
  dealId: string;                // Reference to Deal.id
  pipelineId: string;            // Pipeline reference
  borrowerName: string;          // From Deal.contactName
  borrowerEmail: string;         // From Deal.loanData
  borrowerPhone: string;         // From Deal.loanData
  borrowingEntity?: string;
  borrowerPrimaryResidence?: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  loanAmount: number;
  propertyValue: number;
  ltv: number;
  loanType: 'Purchase' | 'Refinance' | 'Cash Out' | 'HELOC';
  interestOnly?: boolean;
  prepayPeriod?: string;
  lender: string;
  dealStage: 'New' | 'Documents' | 'Review' | 'Underwriting' | 
             'Approved' | 'Closing' | 'Funded' | 'Cancelled';
  targetCloseDate: string;
  assignedAnalysts: string[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
  propertyType?: string;
  occupancyType?: string;
  monthlyRent?: number;
  marketRent?: number;
  interestRate?: number;
  annualTaxes?: number;
  annualInsurance?: number;
  annualHOA?: number;
  monthlyManagementFee?: number;
  dscr?: number;
}
```

#### 4. Loan Document Entity
**File:** `/types/loans.ts`

```typescript
interface LoanDocument {
  id: string;
  loanId: string;               // References Loan.id (= Deal.id)
  fileName: string;
  customName?: string;
  fileType: string;
  fileSize: number;
  category: string;             // e.g., "Application", "Tax Returns"
  status: 'Pending' | 'Uploaded' | 'Reviewed' | 'Approved' | 'Rejected';
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
  fileUrl?: string;
  fileData?: string;
  isRequired: boolean;
  aiSummary?: string;
  extractedFields?: Record<string, any>;
}
```

#### 5. Loan Contact Entity
**File:** `/types/loans.ts`

```typescript
interface LoanContact {
  id: string;
  loanId: string;               // References Loan.id (= Deal.id)
  name: string;
  email: string;
  phone: string;
  role: 'Borrower' | 'Analyst' | 'Lender' | 'Title Company' | 
        'Insurance Agent' | 'Appraiser' | 'Other';
  company?: string;
  notes?: string;
}
```

#### 6. Loan Note Entity
**File:** `/types/loans.ts`

```typescript
interface LoanNote {
  id: string;
  loanId: string;               // References Loan.id (= Deal.id)
  content: string;
  isPinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 7. Task Entity
**File:** `/stores/useTaskStore.ts`

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  contactId: string;
  contactName: string;
  dealId?: string;              // References Deal.id or Loan.id
  dealName?: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  priority?: 'low' | 'medium' | 'high';
  type: 'task' | 'call' | 'email' | 'meeting' | 'follow-up' | 
        'active-deal' | 'document-review';
  assignedTo?: string;
  createdAt: string;
  completedAt?: string;
}
```

---

## Frontend Components

### Deals Module
**File:** `/components/deals-module.tsx` (approx. 1300 lines)

**Key Features:**
- Pipeline selector with multiple pipelines support
- Kanban-style board with drag-and-drop deal cards
- Stage columns with deal counts and total values
- In-card task management (add, edit, complete, delete)
- Deal creation/editing dialogs
- Stage customization (add, edit, reorder, delete stages)
- Contact quick view dialogs
- Deal archiving functionality
- Real-time statistics (total value, weighted value, avg deal size)

**Main Sections:**
1. **Header Section:**
   - Pipeline selector dropdown
   - "New Pipeline" button
   - "New Deal" button
   - "Edit Stages" button
   - Statistics cards (Total Deals, Total Value, Weighted Value, Avg Deal Size)

2. **Pipeline Board:**
   - Horizontal scrollable columns for each stage
   - Stage header with name, count, and total value
   - Draggable deal cards within each column
   - Deal cards show: title, value, contact (clickable), close date, tasks, probability badge
   - Loan badge indicator for deals with `loanData`

3. **Dialogs:**
   - New Deal Dialog (form with contact selector, stage, value, etc.)
   - New Pipeline Dialog
   - Edit Stages Dialog (add, edit, reorder, delete stages)
   - Contact Quick View Dialog

### Loan Processing Module
**File:** `/components/loan-processing-module.tsx` (approx. 2000+ lines)

**Key Features:**
- Three-column layout (sidebar, main content, right panel)
- Pipeline filtering (shows only loan pipelines where `isLoanPipeline: true`)
- Loan list with search
- Multi-tab interface (Details, Documents, Contacts, AI Assistant)
- DSCR calculation with auto-updates
- Document upload and management
- Contact management with frequent contacts
- Email templates with variable substitution
- AI Assistant for loan processing help
- Notes management (pinned notes feature)
- Task integration (show loan-specific tasks)

**Main Sections:**

1. **Left Sidebar (w-80):**
   - "New Loan" button
   - Pipeline selector (filtered to loan pipelines only)
   - Search input
   - Scrollable loan list with selection state

2. **Main Content Area:**
   - **Loan Header:**
     - Borrower avatar and name
     - Property address
     - Key metrics (lender, loan type, amount, LTV, stage badge, close date)
     - "Send to Analyst" button
   
   - **Tabs:**
     - **Details Tab:**
       - Deal stage badge
       - Edit mode toggle
       - Comprehensive form with all loan fields
       - Auto-calculating DSCR display
       - Collapsible sections for better organization
     
     - **Documents Tab:**
       - Document upload interface
       - Document grid/list view
       - Document filtering by category
       - Document preview (placeholder)
       - Status tracking (Pending, Uploaded, Reviewed, Approved, Rejected)
       - Lender-specific required documents checklist
     
     - **Contacts Tab:**
       - Contact list grouped by role
       - Add contact button
       - Frequent contacts quick-add
       - Contact cards with call/email buttons
       - Edit/delete contact actions
     
     - **AI Assistant Tab:**
       - Chat interface
       - Loan-specific AI insights
       - Document analysis suggestions
       - Process guidance
       - Email template generation

3. **Right Panel (Future Enhancement):**
   - Tasks specific to the loan
   - AI-generated insights
   - Quick actions
   - Activity timeline

---

## State Management (Stores)

### useDealsStore
**File:** `/stores/useDealsStore.ts`

**Purpose:** Primary store for all deals and pipelines. This is the single source of truth.

**State:**
```typescript
{
  deals: Deal[];                // All deals (filtered by active pipeline)
  allDeals: Deal[];             // All deals across all pipelines
  pipelines: Pipeline[];        // All pipelines
  activePipelineId: string;     // Currently selected pipeline
  activePipeline: Pipeline;     // Currently selected pipeline object
  stages: PipelineStage[];      // Stages of active pipeline
}
```

**Storage:** LocalStorage
- Key: `adler-capital-deals`
- Key: `adler-capital-pipelines`

**Key Methods:**
- `createDeal(dealData)` - Creates new deal
- `updateDeal(dealId, updates)` - Updates deal fields
- `deleteDeal(dealId)` - Permanently deletes deal
- `archiveDeal(dealId)` - Archives deal (soft delete)
- `moveDeal(dealId, newStage)` - Moves deal to new stage
- `addTaskToDeal(dealId, taskData)` - Adds task to deal
- `updateTask(dealId, taskId, updates)` - Updates deal task
- `deleteTask(dealId, taskId)` - Deletes deal task
- `createPipeline(pipelineData)` - Creates new pipeline
- `updatePipeline(pipelineId, updates)` - Updates pipeline
- `deletePipeline(pipelineId)` - Deletes pipeline and migrates deals
- `addStage(stageData)` - Adds stage to active pipeline
- `updateStage(stageId, updates)` - Updates stage
- `deleteStage(stageId)` - Deletes stage and migrates deals
- `reorderStages(newOrder)` - Reorders stages via drag-and-drop

### useLoanStore
**File:** `/stores/useLoanStore.ts`

**Purpose:** Provides loan-specific abstraction layer over deals store. Handles conversion between Deal ↔ Loan representations.

**State:**
```typescript
{
  loans: Loan[];                      // Virtual - derived from deals with loanData
  loanPipelines: Pipeline[];          // Pipelines where isLoanPipeline: true
  documents: LoanDocument[];          // Separate storage
  emailTemplates: EmailTemplate[];    // Separate storage
  contacts: LoanContact[];            // Separate storage
  notes: LoanNote[];                  // Separate storage
  frequentContacts: LoanContact[];    // Pre-defined frequent contacts
}
```

**Storage:** LocalStorage
- Key: `adler-capital-loan-documents`
- Key: `adler-capital-loan-contacts`
- Key: `adler-capital-loan-notes`
- Key: `adler-capital-email-templates`

**Key Methods:**
- `createLoan(loanData, pipelineId)` - Creates deal with loanData
- `updateLoan(loanId, updates)` - Updates loan fields and syncs to deal
- `deleteLoan(loanId)` - Deletes underlying deal
- `addDocument(docData)` - Adds document to loan
- `updateDocument(docId, updates)` - Updates document
- `deleteDocument(docId)` - Deletes document
- `getDocumentsByLoan(loanId)` - Retrieves documents for a loan
- `addContact(contactData)` - Adds contact to loan
- `updateContact(contactId, updates)` - Updates contact
- `deleteContact(contactId)` - Deletes contact
- `getContactsByLoan(loanId)` - Retrieves contacts for a loan
- `addFrequentContact(loanId, frequentContact)` - Adds pre-defined contact
- `addNote(noteData)` - Adds note to loan
- `updateNote(noteId, updates)` - Updates note
- `deleteNote(noteId)` - Deletes note
- `togglePinNote(noteId)` - Toggles note pin status
- `getNotesByLoan(loanId)` - Retrieves notes for a loan
- `populateTemplate(template, loan)` - Fills email template with loan data

**Helper Functions:**
- `dealToLoan(deal)` - Converts Deal to Loan representation
- `loanToDeal(loanData)` - Converts Loan data to Deal format

### useTaskStore
**File:** `/stores/useTaskStore.ts`

**Purpose:** Manages tasks that can be associated with deals/loans or standalone.

**State:**
```typescript
{
  tasks: Task[];
  taskTypes: TaskTypeDefinition[];
}
```

**Storage:** LocalStorage (Zustand persist middleware)
- Key: `adler-capital-tasks-storage`

**Key Methods:**
- `addTask(taskData)` - Creates new task
- `updateTask(id, updates)` - Updates task
- `deleteTask(id)` - Deletes task
- `toggleTaskStatus(id)` - Toggles task completion
- `getTasksByContact(contactId)` - Filters tasks by contact
- `getTasksByDeal(dealId)` - Filters tasks by deal/loan
- `getOverdueTasks()` - Returns overdue tasks
- `getUpcomingTasks(days)` - Returns tasks due within X days

---

## Complete Workflow - Deals Module

### 1. Viewing Deals
```
User Action: Opens /deals route
     ↓
App.tsx renders DealsModule component
     ↓
DealsModule calls useDealsStore()
     ↓
useDealsStore loads data from LocalStorage (adler-capital-deals, adler-capital-pipelines)
     ↓
DealsModule filters deals by activePipelineId
     ↓
Renders pipeline board with stages as columns
     ↓
Each stage column shows deals filtered by stage ID
     ↓
Deal cards display with:
  - Title, Value, Contact Name (clickable)
  - Expected Close Date
  - Tasks (with inline editing)
  - Probability Badge
  - "Loan" badge if loanData exists
```

### 2. Creating a New Deal
```
User clicks "New Deal" button
     ↓
Dialog opens with form fields:
  - Deal Title (required)
  - Deal Value (required)
  - Contact (dropdown from contacts store) (required)
  - Stage (dropdown from current pipeline stages)
  - Probability (0-100)
  - Expected Close Date
  - Notes
     ↓
User fills form and clicks "Create Deal"
     ↓
DealsModule validates required fields
     ↓
If valid, calls createDeal() from useDealsStore
     ↓
useDealsStore:
  - Generates unique ID (deal-${Date.now()})
  - Creates Deal object with all fields
  - Sets createdAt, updatedAt timestamps
  - Sets pipelineId to activePipelineId
  - Sets archived to false
  - Appends to deals array
  - Saves to LocalStorage (adler-capital-deals)
     ↓
React state updates, triggering re-render
     ↓
New deal card appears in selected stage column
     ↓
Toast notification: "Deal created successfully!"
```

### 3. Moving a Deal Between Stages (Drag & Drop)
```
User drags deal card from one stage column
     ↓
onDragStart event fires:
  - e.dataTransfer.setData('dealId', deal.id)
     ↓
User drags over target stage column
     ↓
onDragOver event fires:
  - e.preventDefault() to allow drop
     ↓
User drops deal card on target stage
     ↓
onDrop event fires:
  - e.preventDefault()
  - Retrieves dealId from e.dataTransfer.getData('dealId')
  - Retrieves target stageId from drop zone
  - Calls moveDeal(dealId, stageId)
     ↓
useDealsStore.moveDeal():
  - Finds deal by dealId
  - Updates deal.stage to new stageId
  - Updates deal.updatedAt timestamp
  - Saves to LocalStorage
     ↓
React state updates, triggering re-render
     ↓
Deal card moves to new stage column
     ↓
Toast notification: "Deal moved successfully!"
```

### 4. Adding a Task to a Deal
```
User clicks "Add Task" button on deal card
     ↓
Browser prompt opens: "Enter task title:"
     ↓
User enters task title and clicks OK
     ↓
Second browser prompt: "Enter due date (YYYY-MM-DD):"
     ↓
User enters date (or prompt uses today's date as default)
     ↓
DealsModule calls addTaskToDeal(dealId, taskData)
     ↓
useDealsStore.addTaskToDeal():
  - Generates unique task ID (task-${Date.now()})
  - Creates DealTask object:
    - id, title, dueDate, completed: false, createdAt
  - Finds deal by dealId
  - Appends task to deal.tasks array
  - Updates deal.updatedAt
  - Saves to LocalStorage
     ↓
React state updates, triggering re-render
     ↓
New task appears in deal card's task list
     ↓
Toast notification: "Task added!"
```

### 5. Editing a Deal
```
User clicks "Edit Deal" from deal card dropdown menu
     ↓
setSelectedDeal(deal) sets the deal in state
     ↓
Edit dialog opens (similar to New Deal dialog)
     ↓
Form pre-populated with existing deal data
     ↓
User modifies fields and clicks "Save"
     ↓
DealsModule calls updateDeal(dealId, updates)
     ↓
useDealsStore.updateDeal():
  - Finds deal by dealId
  - Merges updates into existing deal object
  - Updates deal.updatedAt timestamp
  - Saves to LocalStorage
     ↓
React state updates
     ↓
Deal card reflects updated information
     ↓
Toast notification: "Deal updated!"
```

### 6. Pipeline Management
```
User clicks "New Pipeline" button
     ↓
Dialog opens with form:
  - Pipeline Name (required)
  - Description
     ↓
User fills and clicks "Create"
     ↓
DealsModule calls createPipeline(pipelineData)
     ↓
useDealsStore.createPipeline():
  - Generates unique ID (pipeline-${Date.now()})
  - Creates Pipeline object:
    - id, name, description
    - stages: copy of current pipeline stages
    - isDefault: false
    - isLoanPipeline: false (can be set later)
    - createdAt timestamp
  - Appends to pipelines array
  - Saves to LocalStorage (adler-capital-pipelines)
     ↓
New pipeline appears in pipeline selector dropdown
     ↓
Toast notification: "Pipeline created successfully!"
```

### 7. Stage Customization
```
User clicks "Edit Stages" button
     ↓
Dialog opens showing current pipeline stages
     ↓
User can:
  a) Add New Stage:
     - Enters stage name
     - Selects color from preset colors
     - Clicks "Add Stage"
     - Calls addStage(stageData)
     - New stage added with order = stages.length
  
  b) Edit Existing Stage:
     - Clicks edit icon on stage
     - Updates name and/or color
     - Calls updateStage(stageId, updates)
  
  c) Reorder Stages:
     - Drags stage using grip icon
     - onDrop calls reorderStages(newOrder)
     - Updates all stage.order values
  
  d) Delete Stage:
     - Clicks trash icon
     - Confirmation dialog
     - Calls deleteStage(stageId)
     - Moves all deals in that stage to first stage
     - Removes stage from pipeline
     ↓
All changes saved to LocalStorage
     ↓
Pipeline board re-renders with new stage configuration
```

---

## Complete Workflow - Loan Co-Pilot Module

### 1. Viewing Loans
```
User Action: Opens /loan-processing route
     ↓
App.tsx renders LoanProcessingModule component
     ↓
LoanProcessingModule calls useLoanStore()
     ↓
useLoanStore calls useDealsStore() internally
     ↓
useLoanStore.loans computed:
  - Filters pipelines where isLoanPipeline: true
  - Gets all deals from those pipelines
  - Filters deals that have loanData field
  - Maps each deal through dealToLoan() converter
  - Returns array of Loan objects
     ↓
LoanProcessingModule filters loans by selectedPipelineId
     ↓
Renders left sidebar with loan list
     ↓
Each loan card shows:
  - Borrower avatar with initials
  - Borrower name
  - Property address
  - Lender and loan amount
  - Deal stage badge
     ↓
User clicks on a loan card
     ↓
setSelectedLoan(loan) updates state
     ↓
Main content area displays loan details in tabs
```

### 2. Creating a New Loan
```
User clicks "New Loan" button
     ↓
Dialog opens with form fields:
  - Borrower Name (required)
  - Borrower Email
  - Borrower Phone
  - Property Address
  - Property City, State, Zip
  - Loan Amount (required)
  - Property Value (required)
  - Loan Type (Purchase/Refinance/Cash Out/HELOC)
  - Lender
  - Target Close Date
     ↓
User fills form and clicks "Create Loan"
     ↓
LoanProcessingModule validates required fields
     ↓
Calls createLoan(loanData, selectedPipelineId) from useLoanStore
     ↓
useLoanStore.createLoan():
  - Calls loanToDeal(loanData) helper:
    - Maps loan fields to Deal structure
    - Creates loanData object with all loan-specific fields
    - Calculates LTV: (loanAmount / propertyValue) * 100
    - Sets stage based on dealStage mapping
    - Sets title: "${propertyAddress} - ${loanType}"
    - Sets value to loanAmount
  - Calls useDealsStore.createDeal(dealData)
  - Deal created in deals store with loanData field
  - Converts created deal back to Loan via dealToLoan()
  - Returns Loan object
     ↓
LocalStorage updated (adler-capital-deals)
     ↓
React state updates, triggering re-render
     ↓
New loan appears in left sidebar list
     ↓
Toast notification: "Loan created successfully! (Synced with Deals)"
```

### 3. Editing Loan Details
```
User viewing loan in Details tab
     ↓
Clicks "Edit Loan Details" button
     ↓
setIsEditingLoan(true) enables edit mode
     ↓
Form fields become editable:
  - Borrower Information
  - Property Information
  - Loan Details
  - DSCR Calculation Fields
     ↓
User modifies fields (e.g., monthlyRent, interestRate, annualTaxes)
     ↓
useEffect hook monitors changes:
  - On change to DSCR-related fields:
    - Calls calculateDSCR() utility function:
      - Calculates monthly debt service (interest-only or amortized)
      - Calculates annual debt service
      - Calculates NOI (Net Operating Income):
        NOI = (monthlyRent × 12) - annualExpenses
      - Calculates DSCR: NOI ÷ Annual Debt Service
      - Returns rounded DSCR value
    - Auto-updates loan.dscr in real-time
     ↓
User clicks "Save" button
     ↓
Calls handleSaveLoan()
     ↓
Calls updateLoan(loanId, updates) from useLoanStore
     ↓
useLoanStore.updateLoan():
  - Finds corresponding deal by loanId (= dealId)
  - Maps loan updates to deal updates:
    - borrowerName → contactName
    - targetCloseDate → expectedCloseDate
    - loanAmount → value
    - dealStage → stage (mapped via stageMap)
  - Updates loanData object with all loan-specific fields
  - Recalculates LTV if loanAmount or propertyValue changed
  - Updates title if propertyAddress or loanType changed
  - Calls useDealsStore.updateDeal(dealId, updates)
     ↓
Deal updated in deals store
     ↓
LocalStorage updated
     ↓
React state updates
     ↓
Form returns to read-only mode (setIsEditingLoan(false))
     ↓
Toast notification: "Loan updated successfully!"
     ↓
If user switches to Deals module:
  - Same deal appears with updated values
  - Shows "Loan" badge
  - All changes reflected
```

### 4. Document Upload
```
User selects Documents tab
     ↓
Clicks "Upload Document" button
     ↓
Dialog opens with form:
  - Document Category (dropdown: Application, Tax Returns, etc.)
  - Notes (optional)
  - File upload (simulated in current implementation)
     ↓
User selects category and adds notes
     ↓
Clicks "Upload Document"
     ↓
Calls handleUploadDocument()
     ↓
Calls addDocument(docData) from useLoanStore
     ↓
useLoanStore.addDocument():
  - Generates unique document ID: doc-${Date.now()}-${Math.random()}
  - Creates LoanDocument object:
    - id, loanId (= selectedLoan.id)
    - fileName: "document.pdf" (simulated)
    - fileType, fileSize
    - category, status: "Uploaded"
    - uploadedBy: currentUser.id
    - uploadedAt: current date
    - notes, isRequired: true
  - Appends to documentsStore array
  - Saves to LocalStorage (adler-capital-loan-documents)
  - Calls triggerUpdate() to force re-render
     ↓
Document appears in Documents tab grid
     ↓
Document categorized by selected category
     ↓
Toast notification: "Document uploaded successfully!"
     ↓
Document checklist updates if category was required
```

### 5. Contact Management
```
User selects Contacts tab
     ↓
Clicks "Add Contact" button
     ↓
Dialog opens with form:
  - Contact Name (required)
  - Email (required)
  - Phone (required)
  - Role (dropdown: Borrower, Analyst, Lender, Title Company, etc.)
  - Company (optional)
  - Notes (optional)
     ↓
User fills form and clicks "Add Contact"
  OR
User clicks "Add from Frequent Contacts" and selects pre-defined contact
     ↓
Calls handleAddOrUpdateContact() or addFrequentContact()
     ↓
useLoanStore.addContact() or addFrequentContact():
  - Generates unique contact ID: contact-${Date.now()}-${Math.random()}
  - Creates LoanContact object:
    - id, loanId (= selectedLoan.id)
    - name, email, phone, role, company, notes
  - Appends to contactsStore array
  - Saves to LocalStorage (adler-capital-loan-contacts)
  - Calls triggerUpdate()
     ↓
Contact appears in Contacts tab grouped by role
     ↓
Contact card shows:
  - Name, Role badge, Company
  - Email and Phone
  - Quick action buttons: Call, Email
  - Edit and Delete icons
     ↓
Toast notification: "Contact added successfully!"
```

### 6. Email Template Usage
```
User wants to email a contact (e.g., title company)
     ↓
Clicks email icon on contact card
  OR
Clicks "Send Email" button
     ↓
Email dialog opens with form:
  - Template (dropdown with pre-defined templates)
  - To (pre-filled if from contact card)
  - Subject
  - Body
     ↓
User selects template (e.g., "Title Company Request")
     ↓
Calls handleTemplateSelect(templateId)
     ↓
useLoanStore.populateTemplate():
  - Finds template by templateId
  - Retrieves template.subject and template.body
  - Defines replacement map:
    - {{borrowerName}} → loan.borrowerName
    - {{propertyAddress}} → full property address
    - {{loanAmount}} → formatted loan amount
    - {{loanType}} → loan.loanType
    - {{targetCloseDate}} → loan.targetCloseDate
    - {{lender}} → loan.lender
    - {{agentName}} → current user name
  - Replaces all {{variable}} placeholders in subject and body
  - Returns { subject, body }
     ↓
Email form auto-populates with personalized content
     ↓
User reviews and modifies as needed
     ↓
Clicks "Send Email"
     ↓
Simulated email send (in production, would call email API)
     ↓
Toast notification: "Email sent to {recipient}!"
```

### 7. AI Assistant Interaction
```
User selects AI Assistant tab
     ↓
Chat interface displays with input field
     ↓
User types question: "What documents are missing?"
     ↓
Enters query and clicks Send
     ↓
Calls AI handler with query and selectedLoan context
     ↓
loanAIAssistant.generateFallbackResponse():
  - Analyzes query keywords
  - Checks query type (documents, process, email, DSCR, general)
  - For document query:
    - Retrieves all documents for loan
    - Checks for missing categories
    - Generates response listing missing documents
  - For process query:
    - Analyzes loan stage
    - Provides next steps based on stage
  - For email query:
    - Provides relevant email template
  - For DSCR query:
    - Provides DSCR information and calculations
  - Returns FallbackResponse object
     ↓
Response appears in chat interface
     ↓
User can ask follow-up questions
     ↓
AI maintains context of current loan
```

### 8. Notes Management
```
User wants to add a note about the loan
     ↓
Clicks "Add Note" button
     ↓
Dialog or inline editor opens
     ↓
User types note content
     ↓
Optionally checks "Pin this note" checkbox
     ↓
Clicks "Save Note"
     ↓
Calls addNote(noteData) from useLoanStore
     ↓
useLoanStore.addNote():
  - Generates unique note ID: note-${Date.now()}-${Math.random()}
  - Creates LoanNote object:
    - id, loanId (= selectedLoan.id)
    - content
    - isPinned (from checkbox)
    - createdBy, createdByName (current user)
    - createdAt, updatedAt (timestamps)
  - Appends to notesStore array
  - Saves to LocalStorage (adler-capital-loan-notes)
  - Calls triggerUpdate()
     ↓
Note appears in notes section
     ↓
If pinned, appears at top with pin icon
     ↓
Toast notification: "Note added!"
     ↓
User can edit, delete, or toggle pin status later
```

---

## Synchronization Between Deals & Loans

### Key Principle
**Loans ARE Deals with additional `loanData`.** There is no separate loans database table. This ensures perfect synchronization.

### How It Works

#### Deal → Loan Conversion (dealToLoan)
```typescript
// When useLoanStore retrieves loans:
function dealToLoan(deal: Deal): Loan | null {
  if (!deal.loanData) return null; // Skip non-loan deals
  
  // Map deal stage to loan stage
  const stageMap = {
    'new': 'New',
    'documents': 'Documents',
    'review': 'Review',
    // ... etc
  };
  
  return {
    id: deal.id,                    // Same ID
    dealId: deal.id,                // Reference back
    pipelineId: deal.pipelineId,
    borrowerName: deal.contactName,
    // ... map all loanData fields
    dealStage: stageMap[deal.stage],
    targetCloseDate: deal.expectedCloseDate,
    // ... rest of fields from deal.loanData
  };
}
```

#### Loan → Deal Conversion (loanToDeal)
```typescript
// When creating/updating a loan:
function loanToDeal(loanData): Deal {
  const stageMap = {
    'New': 'new',
    'Documents': 'documents',
    // ... etc
  };
  
  return {
    title: `${loanData.propertyAddress} - ${loanData.loanType}`,
    value: loanData.loanAmount,
    contactName: loanData.borrowerName,
    stage: stageMap[loanData.dealStage],
    expectedCloseDate: loanData.targetCloseDate,
    // ... other deal fields
    loanData: {
      // All loan-specific fields stored here
      borrowerEmail: loanData.borrowerEmail,
      borrowerPhone: loanData.borrowerPhone,
      propertyAddress: loanData.propertyAddress,
      loanAmount: loanData.loanAmount,
      propertyValue: loanData.propertyValue,
      ltv: calculated_ltv,
      dscr: calculated_dscr,
      // ... all other loan fields
    }
  };
}
```

### Synchronization Examples

#### Example 1: Creating a Loan
```
Loan Co-Pilot: createLoan() called
     ↓
loanToDeal() converts loan data to deal format
     ↓
createDeal() called in deals store
     ↓
Deal created with loanData field
     ↓
Saved to LocalStorage (adler-capital-deals)
     ↓
RESULT:
  - Loan appears in Loan Co-Pilot (filtered by pipeline)
  - Same deal appears in Deals module with "Loan" badge
  - Single source of truth
```

#### Example 2: Updating Loan Amount
```
Loan Co-Pilot: User changes loan amount from $500k to $600k
     ↓
updateLoan(loanId, { loanAmount: 600000 }) called
     ↓
useLoanStore.updateLoan():
  - Maps loanAmount update to deal.value
  - Updates deal.loanData.loanAmount
  - Recalculates LTV
  - Calls updateDeal(dealId, updates)
     ↓
Deal updated in deals store
     ↓
RESULT:
  - Loan Co-Pilot shows $600k
  - Deals module shows $600k value
  - Both views updated automatically
```

#### Example 3: Moving Deal Stage
```
Deals Module: User drags deal from "Review" to "Approved"
     ↓
moveDeal(dealId, 'approved') called
     ↓
Deal.stage updated to 'approved'
     ↓
RESULT:
  - Deal appears in "Approved" column
  - If deal has loanData:
    - Loan Co-Pilot shows dealStage as "Approved"
    - Stage mapping: 'approved' → 'Approved'
  - Both modules synchronized
```

#### Example 4: Deleting a Loan
```
Loan Co-Pilot: User deletes a loan
     ↓
deleteLoan(loanId) called
     ↓
useLoanStore.deleteLoan() calls deleteDeal(loanId)
     ↓
Deal permanently removed from deals array
     ↓
RESULT:
  - Loan removed from Loan Co-Pilot
  - Deal removed from Deals module
  - All associated documents, contacts, notes remain in their stores
    but orphaned (can be cleaned up later)
```

### Pipeline Filtering
```typescript
// In Deals Module:
deals.filter(d => d.pipelineId === activePipelineId)

// In Loan Co-Pilot:
const loanPipelines = pipelines.filter(p => p.isLoanPipeline);
const loanPipelineIds = loanPipelines.map(p => p.id);
const loanDeals = allDeals.filter(d => 
  loanPipelineIds.includes(d.pipelineId) && 
  d.loanData !== undefined
);
const loans = loanDeals.map(dealToLoan);
```

**Key Insight:**
- Deals module shows ALL deals in selected pipeline
- Loan Co-Pilot shows ONLY deals with `loanData` from loan pipelines
- Same underlying data, different filters and presentation

---

## Task Management Integration

### Task Association
Tasks can be associated with:
1. **Contacts only** (dealId is undefined)
2. **Deals/Loans** (dealId is set)

### Workflow

#### Creating a Task from Deals Module
```
User adds task to deal card
     ↓
addTaskToDeal(dealId, taskData) called
     ↓
Task embedded in deal.tasks array
     ↓
Task stored inside deal object in LocalStorage
```

#### Creating a Task from Loan Co-Pilot
```
User wants to create task in loan details
     ↓
Opens task dialog
     ↓
Calls useTaskStore.addTask():
  - dealId: selectedLoan.id
  - contactId: contact from loan
  - type: selected type (call, email, document-review, etc.)
     ↓
Task created in tasks store (separate from deal)
     ↓
Saved to LocalStorage (adler-capital-tasks-storage)
```

#### Retrieving Tasks for a Loan
```
Loan details view needs to show tasks
     ↓
Calls getTasksByDeal(selectedLoan.id)
     ↓
useTaskStore.getTasksByDeal():
  - Filters tasks where task.dealId === selectedLoan.id
  - Returns array of tasks
     ↓
Tasks displayed in loan details sidebar
     ↓
Each task shows:
  - Title, Description
  - Contact name (with call/email buttons)
  - Due date, Priority badge
  - Type icon
  - Completion checkbox
```

#### Task Completion
```
User checks task completion checkbox
     ↓
Calls toggleTaskStatus(taskId)
     ↓
useTaskStore.toggleTaskStatus():
  - Finds task by taskId
  - Toggles status: 'pending' ↔ 'completed'
  - Sets completedAt timestamp if completed
  - Saves to LocalStorage
     ↓
Task UI updates with strikethrough or completion indicator
```

### Two Task Systems

**Deal Tasks (Embedded):**
- Stored directly in `deal.tasks[]` array
- Lightweight, simple
- Managed via useDealsStore
- Shown on deal cards in Deals module
- Good for quick task items

**Standalone Tasks (Task Store):**
- Stored in separate useTaskStore
- More detailed (description, priority, type, assignee)
- Can exist without a deal
- Better for complex task management
- Shown in dedicated task views or loan details

**Future Enhancement:** Unify these two systems into one task store

---

## Document Management

### Storage Architecture
Documents are stored separately from deals/loans to allow for:
- Large file metadata
- Independent lifecycle
- Flexible querying
- AI processing results

### Document Categories
Defined in `/types/loans.ts`:
```typescript
const SUGGESTED_DOCUMENT_CATEGORIES = [
  'Application',
  'Income Verification',
  'Tax Returns',
  'Bank Statements',
  'Credit Report',
  'Appraisal',
  'Title Report',
  'Insurance',
  'Purchase Agreement',
  'Payoff Statement',
  'HOA Documents',
  'Property Photos',
  'Contracts',
  'Invoices',
  'Receipts',
  'Other',
];
```

### Lender-Specific Requirements
Defined in `/types/loans.ts`:
```typescript
const LENDER_REQUIRED_DOCS: Record<string, DocumentCategory[]> = {
  'Wells Fargo': [
    'Application',
    'Income Verification',
    'Tax Returns',
    // ... etc
  ],
  'Kiavi': [
    // Kiavi-specific requirements
  ],
  // ... other lenders
};
```

### Document Workflow

#### Upload Process
```
User uploads document
     ↓
Simulated file selection (in production: real file upload)
     ↓
addDocument(docData) called with:
  - loanId
  - fileName (from file)
  - fileType (MIME type)
  - fileSize (in bytes)
  - category (user-selected)
  - status: 'Uploaded'
  - uploadedBy (current user ID)
  - notes (optional)
     ↓
Document saved to LocalStorage
     ↓
In production:
  - File uploaded to cloud storage (S3, Supabase Storage)
  - fileUrl stored in document record
  - AI processing triggered for extraction
  - aiSummary and extractedFields populated
```

#### Document Display
```
Documents tab in Loan Co-Pilot
     ↓
getDocumentsByLoan(selectedLoan.id) retrieves documents
     ↓
Documents displayed in grid/list view
     ↓
Grouped by category or displayed flat
     ↓
Each document card shows:
  - File icon (based on fileType)
  - File name
  - Category badge
  - Status badge (color-coded)
  - Upload date
  - Uploaded by
  - File size
  - Notes (if any)
  - Action buttons: View, Download, Delete
```

#### Required Documents Checklist
```
Loan details view shows checklist
     ↓
Retrieves LENDER_REQUIRED_DOCS[loan.lender]
     ↓
For each required category:
  - Check if document exists in that category
  - Show ✓ if exists, ✗ if missing
  - Display progress bar: X of Y documents uploaded
     ↓
Visual indicator of loan readiness
```

### Future Enhancements
- Real file upload to cloud storage
- Document preview (PDF viewer)
- AI-powered document analysis
- Automatic field extraction
- Document versioning
- Document sharing links

---

## AI Assistant Integration

### Current Implementation
**File:** `/utils/loanAIAssistant.ts`

A local AI assistant that provides contextual responses without external API calls.

### Knowledge Base
The assistant has built-in knowledge about:
- DSCR loan requirements
- Document checklists
- Process workflows
- Email templates
- Common questions and answers

### Query Handling
```typescript
generateFallbackResponse(loanDetails, userQuery)
  ↓
Query analysis:
  - Document-related → generateDocumentResponse()
  - Process/timeline → generateProcessResponse()
  - Email template → generateEmailTemplateResponse()
  - DSCR information → generateDSCRInfoResponse()
  - General → generateGeneralLoanResponse()
  ↓
Returns FallbackResponse { content, sources }
```

### Example Interactions

**Q: "What documents are missing?"**
```
AI checks uploaded documents
     ↓
Compares to required categories
     ↓
Generates response:
  "Based on the current loan file, you're missing:
   - Title Documents (Title Commitment, Property Survey)
   - Insurance Documents (Property Insurance Declaration)
   Would you like me to help create a task list?"
```

**Q: "What are the next steps?"**
```
AI analyzes loan stage
     ↓
Determines current phase (initial_submission, conditional_approval, closing)
     ↓
Returns phase-specific checklist:
  "Based on current status (conditional approval phase):
   1. Address all underwriting conditions
   2. Order property appraisal
   3. Request title commitment
   4. Verify insurance coverage
   5. Finalize loan terms"
```

**Q: "Draft an email to the title company"**
```
AI selects title company email template
     ↓
Populates with loan data
     ↓
Returns formatted email:
  "Here's a template for requesting a title commitment:
   
   Subject: Title Commitment Request for [Property Address]
   
   Hello [Title Agent Name],
   
   I'm working on a DSCR loan for the property at [Address].
   We need to order a title commitment..."
```

### Future Enhancements
- Integration with OpenAI GPT-4 or Claude API
- Document OCR and field extraction
- Loan risk analysis
- Automated email sending
- Calendar integration for deadlines
- Predictive loan approval timeline

---

## API & Data Flow

### Current Architecture (LocalStorage)
```
┌─────────────────────┐
│   React Components   │
│  (Deals, Loans UI)   │
└──────────┬───────────┘
           │
           ↓
┌─────────────────────┐
│   Zustand Stores     │
│  (State Management)  │
│  - useDealsStore     │
│  - useLoanStore      │
│  - useTaskStore      │
└──────────┬───────────┘
           │
           ↓
┌─────────────────────┐
│   LocalStorage       │
│  (Browser Storage)   │
│  - JSON persistence  │
└─────────────────────┘
```

### Future Architecture (Supabase Backend)
```
┌─────────────────────┐
│   React Components   │
│  (Deals, Loans UI)   │
└──────────┬───────────┘
           │
           ↓
┌─────────────────────┐
│   Zustand Stores     │
│  (State + Cache)     │
│  - useDealsStore     │
│  - useLoanStore      │
│  - useTaskStore      │
└──────────┬───────────┘
           │
           ↓
┌─────────────────────┐
│  Supabase Client     │
│  (API Layer)         │
│  - Auth              │
│  - Real-time subs    │
│  - RPC calls         │
└──────────┬───────────┘
           │
           ↓
┌─────────────────────┐
│  Supabase Backend    │
│  - PostgreSQL DB     │
│  - Row Level Security│
│  - Storage           │
│  - Edge Functions    │
└─────────────────────┘
```

### API Operations (Future)

#### Create Deal/Loan
```typescript
// Frontend
const newDeal = await createDeal(dealData);

// Backend (Supabase RPC or direct insert)
INSERT INTO deals (
  title, value, contact_id, stage, probability,
  expected_close_date, notes, pipeline_id, loan_data
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;
```

#### Update Deal/Loan
```typescript
// Frontend
await updateDeal(dealId, updates);

// Backend
UPDATE deals
SET
  value = $1,
  stage = $2,
  loan_data = loan_data || $3,  -- Merge JSON
  updated_at = NOW()
WHERE id = $4
RETURNING *;
```

#### Retrieve Loans for Pipeline
```typescript
// Frontend
const loans = await getLoansForPipeline(pipelineId);

// Backend
SELECT *
FROM deals
WHERE
  pipeline_id = $1 AND
  loan_data IS NOT NULL
ORDER BY created_at DESC;
```

#### Upload Document
```typescript
// Frontend
const document = await uploadDocument(file, loanId, category);

// Backend
-- 1. Upload file to Supabase Storage
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('loan-documents', $1, $2);

-- 2. Create document record
INSERT INTO loan_documents (
  loan_id, file_name, file_url, category, status
) VALUES ($1, $2, $3, $4, 'Uploaded');
```

### Real-time Synchronization (Future)
```typescript
// Subscribe to deal updates
const channel = supabase
  .channel('deals-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'deals',
      filter: `pipeline_id=eq.${activePipelineId}`
    },
    (payload) => {
      // Update local store with payload.new
      updateLocalDeal(payload.new);
    }
  )
  .subscribe();
```

---

## Database Schema

### Future Supabase PostgreSQL Schema

```sql
-- ====================================
-- DEALS TABLE (Primary)
-- ====================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  contact_name TEXT NOT NULL,  -- Denormalized for performance
  stage TEXT NOT NULL,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  notes TEXT,
  tasks JSONB DEFAULT '[]'::jsonb,  -- Embedded tasks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to UUID REFERENCES users(id),
  pipeline_id UUID REFERENCES pipelines(id) NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  
  -- Loan-specific data (JSONB for flexibility)
  loan_data JSONB,  -- Contains all loanData fields when deal is a loan
  
  -- Indexes
  INDEX idx_deals_pipeline (pipeline_id),
  INDEX idx_deals_stage (stage),
  INDEX idx_deals_contact (contact_id),
  INDEX idx_deals_assigned (assigned_to),
  INDEX idx_deals_archived (archived),
  INDEX idx_deals_loan_data ((loan_data IS NOT NULL))  -- For loan filtering
);

-- ====================================
-- PIPELINES TABLE
-- ====================================
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  stages JSONB NOT NULL,  -- Array of {id, name, order, color}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE,
  is_loan_pipeline BOOLEAN DEFAULT FALSE,
  organization_id UUID REFERENCES organizations(id),
  
  INDEX idx_pipelines_org (organization_id),
  INDEX idx_pipelines_loan (is_loan_pipeline)
);

-- ====================================
-- LOAN DOCUMENTS TABLE
-- ====================================
CREATE TABLE loan_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  custom_name TEXT,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_url TEXT,  -- URL in Supabase Storage
  category TEXT NOT NULL,
  status TEXT CHECK (status IN ('Pending', 'Uploaded', 'Reviewed', 'Approved', 'Rejected')),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  ai_summary TEXT,
  extracted_fields JSONB,
  
  INDEX idx_loan_docs_loan (loan_id),
  INDEX idx_loan_docs_category (category),
  INDEX idx_loan_docs_status (status)
);

-- ====================================
-- LOAN CONTACTS TABLE
-- ====================================
CREATE TABLE loan_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT CHECK (role IN ('Borrower', 'Analyst', 'Lender', 'Title Company', 
                             'Insurance Agent', 'Appraiser', 'Other')),
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_loan_contacts_loan (loan_id),
  INDEX idx_loan_contacts_role (role)
);

-- ====================================
-- LOAN NOTES TABLE
-- ====================================
CREATE TABLE loan_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_loan_notes_loan (loan_id),
  INDEX idx_loan_notes_pinned (is_pinned)
);

-- ====================================
-- TASKS TABLE
-- ====================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES contacts(id),
  contact_name TEXT NOT NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  deal_name TEXT,
  due_date DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'overdue')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  type TEXT NOT NULL,
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  INDEX idx_tasks_contact (contact_id),
  INDEX idx_tasks_deal (deal_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_assigned (assigned_to),
  INDEX idx_tasks_due_date (due_date)
);

-- ====================================
-- EMAIL TEMPLATES TABLE
-- ====================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] NOT NULL,  -- Array of variable names like ['{{borrowerName}}']
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id),
  
  INDEX idx_email_templates_category (category),
  INDEX idx_email_templates_org (organization_id)
);

-- ====================================
-- ROW LEVEL SECURITY
-- ====================================

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Policies (Example: Users can only access their organization's data)
CREATE POLICY "Users can view their organization's deals"
  ON deals FOR SELECT
  USING (pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id = auth.jwt() ->> 'organization_id'
  ));

CREATE POLICY "Users can insert deals in their organization"
  ON deals FOR INSERT
  WITH CHECK (pipeline_id IN (
    SELECT id FROM pipelines WHERE organization_id = auth.jwt() ->> 'organization_id'
  ));

-- ... similar policies for other tables

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for deals table
CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for loan_notes table
CREATE TRIGGER update_loan_notes_updated_at
BEFORE UPDATE ON loan_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## File Reference

### Frontend Components
- `/components/deals-module.tsx` - Main deals pipeline interface (~1300 lines)
- `/components/loan-processing-module.tsx` - Loan Co-Pilot interface (~2000+ lines)
- `/components/loan-documents-tab.tsx` - Document management tab component

### State Management
- `/stores/useDealsStore.ts` - Deals and pipelines state (461 lines)
- `/stores/useLoanStore.ts` - Loan-specific operations (615 lines)
- `/stores/useTaskStore.ts` - Task management (342 lines)
- `/stores/useContactStore.ts` - Contact management

### Type Definitions
- `/types/deals.ts` - Deal, Pipeline, PipelineStage, DealTask types (81 lines)
- `/types/loans.ts` - Loan, LoanDocument, LoanContact, LoanNote types (209 lines)

### Utilities
- `/utils/loanAIAssistant.ts` - AI assistant logic (286 lines)
- `/utils/loanDocumentRequirements.ts` - Document requirements by lender
- `/utils/currency.ts` - Currency formatting
- `/utils/formatting.ts` - Number and phone formatting

### Contexts
- `/contexts/AuthContext.tsx` - User authentication
- `/contexts/NavigationContext.tsx` - Global navigation state

### Mock Data
- `/data/mockData.ts` - Sample contacts and initial data

---

## Summary for Augment Code Prompt

### Data Architecture
1. **Single Source of Truth:** Deals store (`useDealsStore`) contains ALL deals and loans
2. **Loan Detection:** Deals with `loanData` field are treated as loans
3. **Virtual Loans:** `useLoanStore` provides loan abstraction via `dealToLoan()` converter
4. **Bidirectional Sync:** Updates in either module automatically reflect in the other
5. **Separate Concerns:** Documents, contacts, notes stored separately but linked by `loanId`

### Key Workflows
1. **Create Loan** → Creates deal with `loanData` → Appears in both modules
2. **Update Loan** → Updates deal and `loanData` → Syncs to both views
3. **Move Deal Stage** → Updates deal.stage → Reflects in loan.dealStage
4. **Upload Document** → Stored separately → Linked to loan via `loanId`
5. **Add Contact** → Stored separately → Linked to loan via `loanId`
6. **Calculate DSCR** → Auto-updates when DSCR fields change → Stored in `loanData.dscr`

### Pipeline System
- **Multiple Pipelines:** Supports unlimited pipelines with custom stages
- **Loan Pipelines:** Pipelines with `isLoanPipeline: true` appear in Loan Co-Pilot
- **Stage Mapping:** Deal stages (lowercase) map to Loan stages (capitalized)
- **Drag & Drop:** Stages and deals can be reordered via drag-and-drop

### Storage Layer
- **Current:** LocalStorage with JSON serialization
- **Future:** Supabase PostgreSQL with real-time subscriptions
- **Migration Path:** Store interfaces support easy backend swap

### Integration Points
- **Tasks:** Can be embedded in deals OR in separate task store
- **Documents:** Always in separate store, linked by `loanId`
- **Contacts:** Always in separate store, linked by `loanId`
- **Notes:** Always in separate store, linked by `loanId`
- **AI Assistant:** Contextual responses based on loan data and documents

This architecture ensures perfect synchronization between Deals and Loan Co-Pilot while maintaining clean separation of concerns and allowing for future scalability.

# Deals & Loan Co-Pilot Implementation Roadmap

## Current Status: 30% Complete

### What Needs to Be Done

#### DEALS MODULE - Missing Features

1. **Kanban Drag-and-Drop** (High Priority)
   - Replace button-based move with drag-and-drop
   - Implement onDragStart, onDragOver, onDrop handlers
   - Visual feedback during drag

2. **Statistics Cards** (High Priority)
   - Total Deals count
   - Total Value sum
   - Weighted Value (value × probability/100)
   - Avg Deal Size

3. **Deal Cards Enhancement** (High Priority)
   - Show contact name (clickable)
   - Add task list with inline editing
   - Add "Loan" badge if loanData exists
   - Add probability badge

4. **Deal Management** (High Priority)
   - Edit Deal dialog
   - Delete Deal functionality
   - Archive Deal functionality

5. **Pipeline Management** (Medium Priority)
   - New Pipeline dialog
   - Edit Stages dialog
   - Add/Edit/Delete/Reorder stages

---

#### LOAN CO-PILOT - Missing Features

1. **Layout Restructure** (Critical)
   - Change from single column to 3-column layout
   - Left sidebar: Loan list (w-80)
   - Main content: Loan details with tabs
   - Right panel: AI Insights, Missing Docs, etc.

2. **Loan Header** (Critical)
   - Borrower avatar with initials
   - Borrower name and property address
   - Key metrics: Lender, Loan Type, Amount, LTV, Stage, Close Date
   - "Send to Analyst" button

3. **Details Tab** (High Priority)
   - Edit mode toggle
   - Comprehensive form with all loan fields
   - DSCR auto-calculation display
   - Collapsible sections:
     - Borrower Information
     - Property Information
     - Loan Details
     - DSCR Calculation Fields

4. **Documents Tab** (High Priority)
   - Upload Document button
   - Document grid/list view
   - Document filtering by category
   - Required documents checklist
   - Document preview placeholder
   - Status tracking (Pending, Uploaded, Reviewed, Approved, Rejected)
   - Connect Drive button

5. **Contacts Tab** (High Priority)
   - Add Contact button with dialog
   - Contact grouping by role
   - Contact cards with:
     - Name, Role badge, Company
     - Email and Phone
     - Call/Email action buttons
     - Edit/Delete icons
   - Frequent contacts quick-add

6. **Email Tab** (High Priority)
   - Compose Email button
   - Email template selection
   - Template variable substitution
   - Email preview
   - Send button

7. **Right Panel** (Medium Priority)
   - AI Insights section
   - Missing Documents display
   - LTV Analysis
   - Suggestions
   - Quick Upload
   - Google Drive integration
   - Recent Activity

8. **AI Assistant Tab** (Medium Priority)
   - Chat interface
   - Loan-specific AI insights
   - Document analysis suggestions
   - Process guidance

9. **Notes Management** (Medium Priority)
   - Add Note button
   - Note list with pinned notes at top
   - Edit/Delete note actions
   - Pin/Unpin toggle

---

## Implementation Order

### Phase 1: Deals Module (Days 1-2)
1. Add statistics cards
2. Implement drag-and-drop
3. Enhance deal cards with tasks and loan badge
4. Add edit/delete/archive functionality

### Phase 2: Loan Co-Pilot Layout (Days 3-4)
1. Restructure to 3-column layout
2. Add loan header
3. Add right panel skeleton
4. Implement proper tab content areas

### Phase 3: Loan Details (Days 5-6)
1. Implement Details tab with edit mode
2. Add DSCR auto-calculation
3. Implement Documents tab with upload
4. Implement Contacts tab with management

### Phase 4: Email & AI (Days 7-8)
1. Implement Email tab with templates
2. Add AI Assistant tab
3. Add Notes management
4. Polish UI and interactions

---

## Files to Modify/Create

### Deals Module
- `/components/deals/deals-pipeline.tsx` - Main component
- `/components/deals/deal-card.tsx` - New component for deal cards
- `/components/deals/statistics-cards.tsx` - New component
- `/components/deals/new-deal-dialog.tsx` - New component
- `/components/deals/edit-stages-dialog.tsx` - New component

### Loan Co-Pilot
- `/components/loan-copilot/loan-copilot.tsx` - Restructure layout
- `/components/loan-copilot/loan-header.tsx` - New component
- `/components/loan-copilot/loan-details-tab.tsx` - New component
- `/components/loan-copilot/loan-documents-tab.tsx` - New component
- `/components/loan-copilot/loan-contacts-tab.tsx` - New component
- `/components/loan-copilot/loan-email-tab.tsx` - New component
- `/components/loan-copilot/loan-ai-tab.tsx` - New component
- `/components/loan-copilot/loan-right-panel.tsx` - New component

### Stores
- `/useLoanStore.ts` - Add missing methods
- `/useDealsStore.ts` - Add missing methods

---

## Estimated Timeline
- **Phase 1**: 8-10 hours
- **Phase 2**: 6-8 hours
- **Phase 3**: 12-15 hours
- **Phase 4**: 8-10 hours

**Total: 34-43 hours**



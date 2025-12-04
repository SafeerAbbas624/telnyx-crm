# Task System - Integration Guide

## 🔗 How to Integrate Task System into Your Pages

### Option 1: Full Task Dashboard (Recommended)

#### For Contact Pages
```typescript
// app/contacts/[id]/page.tsx
import TaskDashboard from '@/components/tasks/task-dashboard';

export default function ContactPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <h1>Contact Details</h1>
      {/* Other contact content */}
      
      {/* Add Task Dashboard */}
      <TaskDashboard contactId={params.id} />
    </div>
  );
}
```

#### For Deal Pages
```typescript
// app/deals/[id]/page.tsx
import TaskDashboard from '@/components/tasks/task-dashboard';

export default function DealPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <h1>Deal Details</h1>
      {/* Other deal content */}
      
      {/* Add Task Dashboard */}
      <TaskDashboard dealId={params.id} />
    </div>
  );
}
```

#### For Both Contact and Deal
```typescript
// app/contacts/[contactId]/deals/[dealId]/page.tsx
import TaskDashboard from '@/components/tasks/task-dashboard';

export default function ContactDealPage({ 
  params 
}: { 
  params: { contactId: string; dealId: string } 
}) {
  return (
    <div className="space-y-6">
      <h1>Contact Deal Details</h1>
      {/* Other content */}
      
      {/* Add Task Dashboard with both IDs */}
      <TaskDashboard 
        contactId={params.contactId} 
        dealId={params.dealId} 
      />
    </div>
  );
}
```

### Option 2: Standalone Tasks Page

```typescript
// app/tasks/page.tsx
import TaskDashboard from '@/components/tasks/task-dashboard';

export default function TasksPage() {
  return (
    <div className="p-6">
      <TaskDashboard />
    </div>
  );
}
```

### Option 3: Sidebar Widget

```typescript
// components/sidebar/task-widget.tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TaskListView from '@/components/tasks/task-list-view';

export default function TaskWidget() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);

  return (
    <div className="border rounded-lg p-4">
      <Button
        variant="ghost"
        className="w-full justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold">Tasks ({tasks.length})</span>
        <ChevronDown className={`w-4 h-4 transition ${expanded ? 'rotate-180' : ''}`} />
      </Button>
      
      {expanded && (
        <div className="mt-4">
          <TaskListView tasks={tasks} onTasksChange={setTasks} />
        </div>
      )}
    </div>
  );
}
```

### Option 4: Modal Dialog

```typescript
// components/dialogs/task-dialog.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TaskDashboard from '@/components/tasks/task-dashboard';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  dealId?: string;
}

export default function TaskDialog({
  open,
  onOpenChange,
  contactId,
  dealId
}: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Tasks</DialogTitle>
        </DialogHeader>
        <TaskDashboard contactId={contactId} dealId={dealId} />
      </DialogContent>
    </Dialog>
  );
}
```

## 📱 Usage Examples

### Example 1: Contact Page with Tasks
```typescript
import TaskDashboard from '@/components/tasks/task-dashboard';
import { getContact } from '@/lib/api';

export default async function ContactPage({ params }) {
  const contact = await getContact(params.id);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: Contact Info */}
      <div className="col-span-1">
        <h2>{contact.firstName} {contact.lastName}</h2>
        <p>{contact.email}</p>
        <p>{contact.phone}</p>
      </div>

      {/* Right: Tasks */}
      <div className="col-span-2">
        <TaskDashboard contactId={params.id} />
      </div>
    </div>
  );
}
```

### Example 2: Dashboard with Task Widget
```typescript
import TaskWidget from '@/components/sidebar/task-widget';

export default function Dashboard() {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-3">
        {/* Main content */}
      </div>
      <div className="col-span-1 space-y-4">
        <TaskWidget />
        {/* Other widgets */}
      </div>
    </div>
  );
}
```

### Example 3: Tab Integration
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskDashboard from '@/components/tasks/task-dashboard';

export default function ContactPage({ params }) {
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        {/* Contact details */}
      </TabsContent>

      <TabsContent value="tasks">
        <TaskDashboard contactId={params.id} />
      </TabsContent>

      <TabsContent value="history">
        {/* Activity history */}
      </TabsContent>
    </Tabs>
  );
}
```

## 🎨 Styling & Customization

### Custom Styling
```typescript
import TaskDashboard from '@/components/tasks/task-dashboard';

export default function CustomTaskPage() {
  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <div className="max-w-6xl mx-auto">
        <TaskDashboard />
      </div>
    </div>
  );
}
```

### Dark Mode Support
```typescript
// The components use Tailwind CSS and support dark mode
// Just add dark: classes to parent elements

<div className="dark">
  <TaskDashboard />
</div>
```

## 🔌 API Integration

### Fetch Tasks Programmatically
```typescript
// Get all tasks
const response = await fetch('/api/activities');
const { activities } = await response.json();

// Get tasks for a contact
const response = await fetch(`/api/activities?contactId=${contactId}`);
const { activities } = await response.json();

// Get tasks for a deal
const response = await fetch(`/api/activities?dealId=${dealId}`);
const { activities } = await response.json();
```

### Create Task Programmatically
```typescript
const response = await fetch('/api/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Follow up call',
    description: 'Call to discuss proposal',
    contactId: 'contact-123',
    dealId: 'deal-456',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000), // Tomorrow
    assignedTo: 'user-789'
  })
});
```

### Update Task Programmatically
```typescript
const response = await fetch(`/api/activities/${taskId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'completed',
    priority: 'medium'
  })
});
```

### Bulk Update Tasks
```typescript
const response = await fetch('/api/activities/bulk-update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskIds: ['task-1', 'task-2', 'task-3'],
    updates: { status: 'completed' }
  })
});
```

## 🎯 Common Integration Patterns

### Pattern 1: Contact Page with Inline Tasks
```
┌─────────────────────────────────────┐
│ Contact: John Doe                   │
├─────────────────────────────────────┤
│ Email: john@example.com             │
│ Phone: (555) 123-4567               │
├─────────────────────────────────────┤
│ Tasks (3)                           │
│ ┌─────────────────────────────────┐ │
│ │ [List/Kanban View]              │ │
│ │ - Follow up call (High)          │ │
│ │ - Send proposal (Medium)         │ │
│ │ - Schedule meeting (Low)         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Pattern 2: Dashboard with Task Widget
```
┌──────────────────────────────────────────┐
│ Dashboard                                │
├──────────────────────────┬───────────────┤
│                          │ Tasks (5)     │
│ Main Content             │ ┌───────────┐ │
│                          │ │ Overdue:1 │ │
│                          │ │ Today: 2  │ │
│                          │ │ Upcoming:2│ │
│                          │ └───────────┘ │
│                          │               │
│                          │ [View All]    │
└──────────────────────────┴───────────────┘
```

### Pattern 3: Tabbed Interface
```
┌─────────────────────────────────────┐
│ [Details] [Tasks] [History]         │
├─────────────────────────────────────┤
│ Tasks Tab Content                   │
│ ┌─────────────────────────────────┐ │
│ │ [List] [Kanban]                 │ │
│ │ [Search] [Filters]              │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Task List/Kanban            │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 🚀 Performance Tips

### 1. Lazy Load Task Dashboard
```typescript
import dynamic from 'next/dynamic';

const TaskDashboard = dynamic(
  () => import('@/components/tasks/task-dashboard'),
  { loading: () => <div>Loading tasks...</div> }
);
```

### 2. Memoize Component
```typescript
import { memo } from 'react';
import TaskDashboard from '@/components/tasks/task-dashboard';

export default memo(function ContactPage({ params }) {
  return <TaskDashboard contactId={params.id} />;
});
```

### 3. Pagination for Large Lists
```typescript
// Fetch tasks with pagination
const response = await fetch(
  `/api/activities?contactId=${contactId}&page=1&limit=20`
);
```

## 🔒 Security Considerations

### Authentication
- All endpoints require authentication
- Use NextAuth.js session
- Verify user permissions

### Authorization
- Only show tasks user has access to
- Validate contactId and dealId
- Check user permissions before updates

### Input Validation
- Validate all inputs on backend
- Sanitize user data
- Use TypeScript for type safety

## 📊 Monitoring & Debugging

### Check Component Rendering
```typescript
// Add console logs
console.log('TaskDashboard mounted');
console.log('Tasks loaded:', tasks);
```

### Monitor API Calls
```typescript
// Check Network tab in DevTools
// Look for /api/activities requests
// Check response status and data
```

### Check Database
```bash
# Verify tasks in database
npx prisma studio

# Or query directly
SELECT * FROM activities WHERE contact_id = 'xxx';
```

---

**Last Updated**: November 9, 2025
**Version**: 1.0
**Status**: Ready for Integration


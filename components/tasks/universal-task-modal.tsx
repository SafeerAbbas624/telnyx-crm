'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UniversalTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any; // If provided, edit mode. If null, create mode
  contactId?: string;
  onSuccess?: (task: any) => void;
}

export default function UniversalTaskModal({
  open,
  onOpenChange,
  task,
  contactId,
  onSuccess,
}: UniversalTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contactId: contactId || '',
    priority: 'medium',
    status: 'planned',
    dueDate: '',
    dueTime: '09:00',
  });

  const isEditMode = !!task;

  // Load contacts for dropdown
  useEffect(() => {
    if (open && !isEditMode) {
      fetch('/api/contacts?limit=1000')
        .then(res => res.json())
        .then(data => setContacts(data.contacts || []))
        .catch(err => console.error('Error loading contacts:', err));
    }
  }, [open, isEditMode]);

  // Initialize form with task data in edit mode
  useEffect(() => {
    if (task && open) {
      const dueDate = task.due_date || task.dueDate ? new Date(task.due_date || task.dueDate) : null;
      setFormData({
        title: task.title || '',
        description: task.description || '',
        contactId: task.contact_id || task.contactId || contactId || '',
        priority: task.priority || 'medium',
        status: task.status || 'planned',
        dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
        dueTime: dueDate ? dueDate.toISOString().split('T')[1].slice(0, 5) : '09:00',
      });
    } else if (!task && open) {
      // Reset form for create mode
      setFormData({
        title: '',
        description: '',
        contactId: contactId || '',
        priority: 'medium',
        status: 'planned',
        dueDate: '',
        dueTime: '09:00',
      });
    }
  }, [task, open, contactId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    try {
      setLoading(true);

      const dueDateTime = formData.dueDate
        ? new Date(`${formData.dueDate}T${formData.dueTime}:00`).toISOString()
        : null;

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        status: formData.status,
        dueDate: dueDateTime,
        type: 'task',
        contactId: formData.contactId || null,
      };

      const url = isEditMode ? `/api/activities/${task.id}` : '/api/activities';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save task');
      }

      const savedTask = await response.json();
      toast.success(isEditMode ? 'Task updated successfully' : 'Task created successfully');
      
      if (onSuccess) {
        onSuccess(savedTask);
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          {/* Contact Selection - Only show in create mode or if no contactId prop */}
          {(!isEditMode && !contactId) && (
            <div className="space-y-2">
              <Label htmlFor="contact">Contact</Label>
              <Select
                value={formData.contactId}
                onValueChange={(value) => setFormData({ ...formData, contactId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No contact</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dueDate ? format(new Date(formData.dueDate), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start" sideOffset={5}>
                  <Calendar
                    mode="single"
                    selected={formData.dueDate ? new Date(formData.dueDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, dueDate: format(date, 'yyyy-MM-dd') });
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueTime">Due Time</Label>
              <Input
                id="dueTime"
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


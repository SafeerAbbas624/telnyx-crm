'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickAddTaskButtonProps {
  contactId?: string;
  contactName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onTaskCreated?: () => void;
}

export default function QuickAddTaskButton({
  contactId,
  contactName,
  variant = 'default',
  size = 'default',
  className,
  onTaskCreated,
}: QuickAddTaskButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dueDate, setDueDate] = useState<Date>();
  const [formData, setFormData] = useState({
    taskType: '',
    customTaskType: '',
    subject: '',
    description: '',
    priority: 'medium',
    contactId: contactId || '',
  });

  // Predefined task types
  const predefinedTaskTypes = [
    'Dan Task',
    'Joe Task',
    'Edwin Task',
    'Call',
    'Follow-up',
    'Meeting',
    'Email',
    'Review',
    'Custom',
  ];

  const handleSubmit = async () => {
    // Validate task type
    const finalTaskType = formData.taskType === 'Custom'
      ? formData.customTaskType.trim()
      : formData.taskType;

    if (!finalTaskType) {
      toast.error('Please select or enter a task type');
      return;
    }

    if (!formData.subject.trim()) {
      toast.error('Please enter a task subject');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'task',
          taskType: finalTaskType,
          subject: formData.subject,
          description: formData.description,
          priority: formData.priority,
          status: 'planned',
          dueDate: dueDate?.toISOString(),
          contactId: formData.contactId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      toast.success('Task created successfully');
      setOpen(false);
      setFormData({
        taskType: '',
        customTaskType: '',
        subject: '',
        description: '',
        priority: 'medium',
        contactId: contactId || ''
      });
      setDueDate(undefined);

      if (onTaskCreated) {
        onTaskCreated();
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            {contactName ? `Create a task for ${contactName}` : 'Create a new task'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Task Type */}
          <div className="space-y-2">
            <Label htmlFor="taskType">Task Type *</Label>
            <Select
              value={formData.taskType}
              onValueChange={(value) => setFormData({ ...formData, taskType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                {predefinedTaskTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Task Type Input (shown when "Custom" is selected) */}
          {formData.taskType === 'Custom' && (
            <div className="space-y-2">
              <Label htmlFor="customTaskType">Custom Task Type *</Label>
              <Input
                id="customTaskType"
                placeholder="Enter custom task type (e.g., Sarah Task, Inspection)"
                value={formData.customTaskType}
                onChange={(e) => setFormData({ ...formData, customTaskType: e.target.value })}
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="e.g., call john smith to discuss quadplex refinance"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional task details..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Priority and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start" sideOffset={5}>
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


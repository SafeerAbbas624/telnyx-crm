'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal, MessageSquare, Paperclip, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface TaskCardProps {
  task: any;
  onTasksChange: (tasks: any[]) => void;
  onEdit?: (task: any) => void;
  onAssign?: (task: any) => void;
}

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
};

const typeIcons = {
  task: '📋',
  call: '📞',
  email: '📧',
  meeting: '🤝',
  'follow-up': '🔄',
  'active-deal': '💼',
  'document-review': '📄'
};

export default function TaskCard({ task, onTasksChange, onEdit, onAssign }: TaskCardProps) {
  const { toast } = useToast();
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  const handleToggleComplete = async () => {
    try {
      const newStatus = task.status === 'completed' ? 'planned' : 'completed';
      const response = await fetch(`/api/activities/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update task');
      const updated = await response.json();
      onTasksChange([updated]);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="p-3 bg-white hover:shadow-md transition cursor-pointer">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <Checkbox
              checked={task.status === 'completed'}
              onCheckedChange={handleToggleComplete}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-tight ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                {task.title}
              </p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <p className="font-semibold">
                  {task.contact?.firstName} {task.contact?.lastName}
                </p>
                {task.contact?.email && (
                  <p className="truncate">{task.contact.email}</p>
                )}
                {task.contact?.phone && (
                  <p>{task.contact.phone}</p>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(task)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAssign?.(task)}>Assign to Team Member</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {task.priority && (
            <Badge className={`text-xs ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
              {task.priority}
            </Badge>
          )}
          {isOverdue && (
            <Badge className="text-xs bg-red-100 text-red-800">Overdue</Badge>
          )}
        </div>

        {/* Due Date */}
        {task.dueDate && (
          <div className="text-xs text-gray-600 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </div>
        )}

        {/* Footer - Meta Info */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
          <div className="flex items-center gap-2">
            {task.comments_count > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {task.comments_count}
              </div>
            )}
            {task.attachments_count > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {task.attachments_count}
              </div>
            )}
          </div>
          {task.assignedTo && (
            <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs font-semibold">
              {task.assignedTo.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}


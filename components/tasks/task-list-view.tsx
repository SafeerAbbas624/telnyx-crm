'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Trash2, Edit2, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TaskCard from './task-card';
import BulkActionsToolbar from './bulk-actions-toolbar';
import { useToast } from '@/hooks/use-toast';

interface TaskListViewProps {
  tasks: any[];
  onTasksChange: (tasks: any[]) => void;
  onEdit?: (task: any) => void;
  onAssign?: (task: any) => void;
}

const priorityColors = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800'
};

const statusColors = {
  planned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

export default function TaskListView({ tasks, onTasksChange, onEdit, onAssign }: TaskListViewProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const { toast } = useToast();

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(tasks.map(t => t.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks([...selectedTasks, taskId]);
    } else {
      setSelectedTasks(selectedTasks.filter(id => id !== taskId));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/activities/${taskId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete task');
      
      onTasksChange(tasks.filter(t => t.id !== taskId));
      toast({
        title: 'Success',
        description: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    }
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'planned' : 'completed';
      const response = await fetch(`/api/activities/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update task');
      
      const updated = await response.json();
      onTasksChange(tasks.map(t => t.id === taskId ? updated : t));
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">No tasks found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {selectedTasks.length > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedTasks.length}
          onClearSelection={() => setSelectedTasks([])}
          selectedTaskIds={selectedTasks}
          onTasksChange={onTasksChange}
        />
      )}

      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg font-semibold text-sm">
          <Checkbox
            checked={selectedTasks.length === tasks.length && tasks.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <div className="flex-1">Title</div>
          <div className="w-40">Contact</div>
          <div className="w-24">Priority</div>
          <div className="w-24">Status</div>
          <div className="w-32">Due Date</div>
          <div className="w-20">Actions</div>
        </div>

        {/* Tasks */}
        {tasks.map(task => (
          <div
            key={task.id}
            className="flex items-center gap-4 px-4 py-3 bg-white border rounded-lg hover:bg-gray-50 transition"
          >
            <Checkbox
              checked={selectedTasks.includes(task.id)}
              onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
            />
            <div className="flex-1">
              <div className="font-medium">{task.title}</div>
              <div className="text-sm text-gray-500">{task.description}</div>
            </div>
            <div className="w-40">
              <div className="text-sm font-medium">{task.contact?.firstName} {task.contact?.lastName}</div>
              <div className="text-xs text-gray-500">{task.contact?.email}</div>
            </div>
            <div className="w-24">
              <Badge className={priorityColors[task.priority as keyof typeof priorityColors] || 'bg-gray-100'}>
                {task.priority || 'N/A'}
              </Badge>
            </div>
            <div className="w-24">
              <Badge className={statusColors[task.status as keyof typeof statusColors] || 'bg-gray-100'}>
                {task.status}
              </Badge>
            </div>
            <div className="w-32 text-sm">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
            </div>
            <div className="w-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleToggleComplete(task.id, task.status)}>
                    {task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit?.(task)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAssign?.(task)}>
                    <User className="w-4 h-4 mr-2" />
                    Assign to Team Member
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


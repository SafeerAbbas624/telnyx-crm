'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  selectedTaskIds: string[];
  onTasksChange: (tasks: any[]) => void;
}

export default function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  selectedTaskIds,
  onTasksChange
}: BulkActionsToolbarProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/activities/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          updates: { status: newStatus }
        })
      });

      if (!response.ok) throw new Error('Failed to update tasks');
      
      toast({
        title: 'Success',
        description: `Updated ${selectedCount} tasks`
      });
      onClearSelection();
    } catch (error) {
      console.error('Error updating tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPriorityChange = async (newPriority: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/activities/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          updates: { priority: newPriority }
        })
      });

      if (!response.ok) throw new Error('Failed to update tasks');
      
      toast({
        title: 'Success',
        description: `Updated ${selectedCount} tasks`
      });
      onClearSelection();
    } catch (error) {
      console.error('Error updating tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedCount} tasks?`)) return;

    try {
      setLoading(true);
      const response = await fetch('/api/activities/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: selectedTaskIds })
      });

      if (!response.ok) throw new Error('Failed to delete tasks');
      
      toast({
        title: 'Success',
        description: `Deleted ${selectedCount} tasks`
      });
      onClearSelection();
    } catch (error) {
      console.error('Error deleting tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{selectedCount} selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select onValueChange={handleBulkStatusChange} disabled={loading}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={handleBulkPriorityChange} disabled={loading}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Change Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={loading}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}


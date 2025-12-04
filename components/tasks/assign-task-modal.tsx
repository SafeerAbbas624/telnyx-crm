'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';

interface AssignTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any;
  onTaskAssigned: (task: any) => void;
}

export default function AssignTaskModal({
  open,
  onOpenChange,
  task,
  onTaskAssigned,
}: AssignTaskModalProps) {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    task?.assigned_to || ''
  );
  const { toast } = useToast();

  // Fetch team members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch('/api/admin/team-users');
        if (response.ok) {
          const data = await response.json();
          setTeamMembers(data.users || data || []);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    if (open) {
      fetchTeamMembers();
      setSelectedUserId(task?.assigned_to || '');
    }
  }, [open, task]);

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a team member',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/tasks/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          assignedToUserId: selectedUserId,
        }),
      });

      if (!response.ok) throw new Error('Failed to assign task');

      const updatedTask = await response.json();
      toast({
        title: 'Success',
        description: 'Task assigned successfully',
      });

      onTaskAssigned(updatedTask);
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign task',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign Task to Team Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Task</p>
            <p className="text-sm font-semibold">{task?.title}</p>
            <p className="text-xs text-gray-500 mt-1">
              {task?.contact?.firstName} {task?.contact?.lastName}
            </p>
          </div>

          {/* Team Member Selection */}
          <div>
            <label className="text-sm font-medium">Assign to Team Member</label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Assignment */}
          {task?.assignedUser && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600">
                Currently assigned to:{' '}
                <span className="font-semibold">
                  {task.assignedUser.firstName} {task.assignedUser.lastName}
                </span>
              </p>
            </div>
          )}
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
          <Button onClick={handleAssign} disabled={loading}>
            {loading ? 'Assigning...' : 'Assign Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


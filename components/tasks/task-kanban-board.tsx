'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical } from 'lucide-react';
import TaskCard from './task-card';
import { useToast } from '@/hooks/use-toast';

interface TaskKanbanBoardProps {
  tasks: any[];
  onTasksChange: (tasks: any[]) => void;
  onEdit?: (task: any) => void;
  onAssign?: (task: any) => void;
}

const columns = [
  { id: 'planned', label: 'To Do', color: 'bg-blue-50' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-purple-50' },
  { id: 'completed', label: 'Done', color: 'bg-green-50' },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-gray-50' }
];

export default function TaskKanbanBoard({ tasks, onTasksChange, onEdit, onAssign }: TaskKanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<any>(null);
  const { toast } = useToast();

  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => t.status === status);
  };

  const handleDragStart = (e: React.DragEvent, task: any) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) return;

    try {
      const response = await fetch(`/api/activities/${draggedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update task');

      const updated = await response.json();
      onTasksChange(tasks.map(t => t.id === draggedTask.id ? updated : t));
      setDraggedTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to move task',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
      {columns.map(column => {
        const columnTasks = getTasksByStatus(column.id);
        return (
          <div key={column.id} className={`flex-shrink-0 w-80 ${column.color} rounded-lg p-4`}>
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{column.label}</h3>
                <Badge variant="secondary">{columnTasks.length}</Badge>
              </div>
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Tasks Container */}
            <div
              className="space-y-3 min-h-96"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {columnTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No tasks</p>
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    className="cursor-move"
                  >
                    <TaskCard task={task} onTasksChange={onTasksChange} onEdit={onEdit} onAssign={onAssign} />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


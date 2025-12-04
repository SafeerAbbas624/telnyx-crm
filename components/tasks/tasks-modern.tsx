'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Filter, CheckCircle2, Circle, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTaskUI } from '@/lib/context/task-ui-context';

interface Task {
  id: string;
  subject: string;
  description?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'completed';
  contactId?: string;
  contactName?: string;
  assignedTo?: string;
  createdAt: Date;
}

export default function TasksModern() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'completed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const { openTask } = useTaskUI();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'completed' : 'open';
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Task marked as ${newStatus}`);
        loadTasks();
      } else {
        toast.error('Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.contactName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const openTasks = filteredTasks.filter((t) => t.status === 'open');
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-sm text-gray-600">Manage your tasks and to-dos</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => openTask()}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(value: any) => setFilterPriority(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Lists */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Open Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Open Tasks</span>
                <Badge variant="secondary">{openTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading tasks...</div>
              ) : openTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No open tasks</div>
              ) : (
                <div className="space-y-3">
                  {openTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50">
                      <button onClick={() => toggleTaskStatus(task.id, task.status)} className="mt-1">
                        <Circle className="h-5 w-5 text-gray-400 hover:text-blue-600" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">{task.subject}</h4>
                          {task.priority === 'high' && <Badge variant="destructive" className="text-xs">High</Badge>}
                          {task.priority === 'medium' && <Badge variant="default" className="text-xs">Medium</Badge>}
                          {task.priority === 'low' && <Badge variant="secondary" className="text-xs">Low</Badge>}
                        </div>
                        {task.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.dueDate), 'MMM d, yyyy')}
                            </span>
                          )}
                          {task.contactName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.contactName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Completed Tasks</span>
                <Badge variant="secondary">{completedTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading tasks...</div>
              ) : completedTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No completed tasks</div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 opacity-60">
                      <button onClick={() => toggleTaskStatus(task.id, task.status)} className="mt-1">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate line-through">{task.subject}</h4>
                          {task.priority === 'high' && <Badge variant="destructive" className="text-xs">High</Badge>}
                          {task.priority === 'medium' && <Badge variant="default" className="text-xs">Medium</Badge>}
                          {task.priority === 'low' && <Badge variant="secondary" className="text-xs">Low</Badge>}
                        </div>
                        {task.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2 line-through">{task.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.dueDate), 'MMM d, yyyy')}
                            </span>
                          )}
                          {task.contactName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.contactName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


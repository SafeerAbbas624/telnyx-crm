'use client';

import { useState, useEffect } from 'react';
import { Activity, Plus, Filter, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskListView from './task-list-view';
import TaskKanbanBoard from './task-kanban-board';
import TaskFilters from './task-filters';
import TaskTemplateManager from './task-template-manager';
import WorkflowBuilder from './workflow-builder';
import AssignTaskModal from './assign-task-modal';
import TaskReplies from './task-replies';
import { useToast } from '@/hooks/use-toast';
import { useTaskUI } from '@/lib/context/task-ui-context';

interface TaskDashboardProps {
  contactId?: string;
  dealId?: string;
}

export default function TaskDashboard({ contactId, dealId }: TaskDashboardProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assignee: 'all',
    dueDate: 'all',
    search: ''
  });
  const { toast } = useToast();
  const { openTask } = useTaskUI();

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (contactId) params.append('contactId', contactId);
        if (dealId) params.append('dealId', dealId);

        const response = await fetch(`/api/activities?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch tasks');

        const data = await response.json();
        // Filter to only show tasks (type === 'task')
        const allActivities = Array.isArray(data) ? data : (data.activities || []);
        const tasksOnly = allActivities.filter((activity: any) => activity.type === 'task');
        setTasks(tasksOnly);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load tasks',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [contactId, dealId, toast]);

  // Apply filters
  useEffect(() => {
    let filtered = tasks;

    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(t => t.priority === filters.priority);
    }

    if (filters.assignee !== 'all') {
      filtered = filtered.filter(t => t.assignedTo === filters.assignee);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search)
      );
    }

    setFilteredTasks(filtered);
  }, [tasks, filters]);

  // Calculate stats
  const stats = {
    total: tasks.length,
    overdue: tasks.filter(t => t.status === 'planned' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    today: tasks.filter(t => {
      const today = new Date().toDateString();
      return t.dueDate && new Date(t.dueDate).toDateString() === today;
    }).length,
    upcoming: tasks.filter(t => t.status === 'planned').length
  };

  const handleTasksChange = (updatedTasks: any[]) => {
    setTasks(prevTasks => {
      const updated = [...prevTasks];
      updatedTasks.forEach(updatedTask => {
        const index = updated.findIndex(t => t.id === updatedTask.id);
        if (index >= 0) {
          updated[index] = updatedTask;
        }
      });
      return updated;
    });
  };

  const handleTaskCreated = (newTask: any) => {
    setTasks(prevTasks => [newTask, ...prevTasks]);
  };

  const handleTaskUpdated = (updatedTask: any) => {
    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === updatedTask.id ? updatedTask : t))
    );
  };

  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    openTask({
      taskId: task.id,
      isEditMode: true,
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      priority: task.priority || 'medium',
      contactId: task.contactId || undefined,
    });
  };

  const handleAssignTask = (task: any) => {
    setSelectedTask(task);
    setAssignModalOpen(true);
  };

  const handleTaskAssigned = (updatedTask: any) => {
    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Tasks</h1>
        </div>
        <Button className="gap-2" onClick={() => openTask({ contactId })}>
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          {/* Filters and View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <TaskFilters filters={filters} onFiltersChange={setFilters} />
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="w-4 h-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </Button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-gray-500">Loading tasks...</div>
            </div>
          ) : viewMode === 'list' ? (
            <TaskListView tasks={filteredTasks} onTasksChange={setTasks} onEdit={handleEditTask} onAssign={handleAssignTask} />
          ) : (
            <TaskKanbanBoard tasks={filteredTasks} onTasksChange={setTasks} onEdit={handleEditTask} onAssign={handleAssignTask} />
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card className="p-6">
            <TaskTemplateManager />
          </Card>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows">
          <Card className="p-6">
            <WorkflowBuilder />
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Task Settings</h3>
              <p className="text-sm text-gray-600">
                Configure task system preferences and automation rules.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">Enable task notifications</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm">Enable email reminders</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Enable task automation</span>
                </label>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Task Modal */}
      <AssignTaskModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        task={selectedTask}
        onTaskAssigned={handleTaskAssigned}
      />
    </div>
  );
}


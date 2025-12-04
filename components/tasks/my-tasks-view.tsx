'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, CheckCircle, AlertCircle, User, Edit } from 'lucide-react';
import TaskReplies from './task-replies';
import { useToast } from '@/hooks/use-toast';
import { useTaskUI } from '@/lib/context/task-ui-context';

export default function MyTasksView() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('me');
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const { openTask } = useTaskUI();


  // Load team users for admin so they can filter by assignee
  useEffect(() => {
    const fetchTeamUsers = async () => {
      try {
        const response = await fetch('/api/admin/team-users');
        if (response.ok) {
          const data = await response.json();
          setTeamUsers(data.users || []);
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error fetching team users:', error);
        setIsAdmin(false);
      }
    };

    fetchTeamUsers();
  }, []);

  // Fetch tasks based on status and assignee filter
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);

        if (assigneeFilter === 'all') {
          params.append('userId', 'all');
        } else if (assigneeFilter !== 'me') {
          params.append('userId', assigneeFilter);
        }

        const response = await fetch(`/api/tasks/my-tasks?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || []);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load tasks',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [statusFilter, assigneeFilter, toast]);

  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
    urgent: 'bg-red-200 text-red-900',
  };

  const getSubtitle = () => {
    if (!isAdmin || assigneeFilter === 'me') {
      return 'Tasks assigned to you';
    }

    if (assigneeFilter === 'all') {
      return 'Tasks assigned to all team members';
    }

    const user = teamUsers.find((u: any) => u.id === assigneeFilter);
    if (user) {
      return `Tasks assigned to ${user.firstName} ${user.lastName}`;
    }

    return 'Tasks assigned to selected user';
  };

  const getEmptyMessage = () => {
    if (!isAdmin || assigneeFilter === 'me') {
      return 'No tasks assigned to you';
    }

    if (assigneeFilter === 'all') {
      return 'No tasks found for any team member';
    }

    const user = teamUsers.find((u: any) => u.id === assigneeFilter);
    if (user) {
      return `No tasks assigned to ${user.firstName} ${user.lastName}`;
    }

    return 'No tasks found';
  };

  const statusIcons = {
    planned: <Clock className="w-4 h-4" />,
    in_progress: <Clock className="w-4 h-4 text-blue-600" />,
    completed: <CheckCircle className="w-4 h-4 text-green-600" />,
  };

  const isOverdue = (task: any) => {
    return (
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      task.status !== 'completed'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Tasks</h1>
        <p className="text-gray-600 mt-1">{getSubtitle()}</p>
      </div>

      {/* Admin Assignee Filter */}
      {isAdmin && (
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Viewing tasks for</p>
            <Select
              value={assigneeFilter}
              onValueChange={(value) => {
                setAssigneeFilter(value);
                setSelectedTask(null);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Me</SelectItem>
                <SelectItem value="all">All users</SelectItem>
                {teamUsers.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold">{tasks.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">To Do</p>
          <p className="text-2xl font-bold">
            {tasks.filter((t) => t.status === 'planned').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">In Progress</p>
          <p className="text-2xl font-bold">
            {tasks.filter((t) => t.status === 'in_progress').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Completed</p>
          <p className="text-2xl font-bold">
            {tasks.filter((t) => t.status === 'completed').length}
          </p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
          <TabsTrigger value="planned">To Do</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {getEmptyMessage()}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Task List */}
              <div className="lg:col-span-1 space-y-3">
                {tasks.map((task) => (
                  <Card
                    key={task.id}
                    className={`p-3 cursor-pointer hover:shadow-md transition ${
                      selectedTask?.id === task.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {task.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {task.contact?.firstName} {task.contact?.lastName}
                          </p>
                          {isAdmin && assigneeFilter !== 'me' && task.assignedUser && (
                            <p className="text-xs text-gray-500 mt-1">
                              Assigned to: {task.assignedUser.firstName}{' '}
                              {task.assignedUser.lastName}
                            </p>
                          )}
                        </div>
                        {statusIcons[task.status as keyof typeof statusIcons]}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {task.priority && (
                          <Badge
                            className={`text-xs ${
                              priorityColors[
                                task.priority as keyof typeof priorityColors
                              ]
                            }`}
                          >
                            {task.priority}
                          </Badge>
                        )}
                        {isOverdue(task) && (
                          <Badge className="text-xs bg-red-100 text-red-800">
                            Overdue
                          </Badge>
                        )}
                      </div>

                      {task.dueDate && (
                        <p className="text-xs text-gray-600">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Task Details */}
              {selectedTask && (
                <div className="lg:col-span-2">
                  <Card className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold">{selectedTask.title}</h2>
                        <p className="text-gray-600 mt-2">
                          {selectedTask.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          openTask({
                            taskId: selectedTask.id,
                            isEditMode: true,
                            title: selectedTask.title,
                            description: selectedTask.description || '',
                            dueDate: selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : '',
                            priority: selectedTask.priority || 'medium',
                            contactId: selectedTask.contactId || undefined,
                          });
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y">
                      <div>
                        <p className="text-sm text-gray-600">Contact</p>
                        <p className="font-semibold">
                          {selectedTask.contact?.firstName}{' '}
                          {selectedTask.contact?.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {selectedTask.contact?.email1}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Due Date</p>
                        <p className="font-semibold">
                          {selectedTask.dueDate
                            ? new Date(selectedTask.dueDate).toLocaleDateString()
                            : 'No due date'}
                        </p>
                      </div>
                    </div>

                    {/* Task Replies */}
                    <TaskReplies taskId={selectedTask.id} isAssignee={true} />
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}


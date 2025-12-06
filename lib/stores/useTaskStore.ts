import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TaskType = 'task' | 'call' | 'email' | 'meeting' | 'follow-up' | 'active-deal' | 'document-review';

export interface Task {
  id: string;
  title: string;
  description?: string;
  contactId: string;
  contactName: string;
  dealId?: string;
  dealName?: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  priority?: 'low' | 'medium' | 'high';
  type: TaskType;
  assignedTo?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TaskTypeDefinition {
  id: TaskType | string;
  label: string;
  icon: string;
  color: string;
}

interface TaskStore {
  tasks: Task[];
  taskTypes: TaskTypeDefinition[];
  
  // Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  
  // Task type management
  addTaskType: (taskType: Omit<TaskTypeDefinition, 'id'> & { id?: string }) => void;
  updateTaskType: (id: string, updates: Partial<TaskTypeDefinition>) => void;
  deleteTaskType: (id: string) => void;
  
  // Queries
  getTasksByContact: (contactId: string) => Task[];
  getTasksByDeal: (dealId: string) => Task[];
  getOverdueTasks: () => Task[];
  getUpcomingTasks: (days?: number) => Task[];
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
  tasks: [
    {
      id: '1',
      title: 'Follow up on loan application',
      description: 'Check if all documents have been submitted',
      contactId: '1',
      contactName: 'Emily Rodriguez',
      dealId: 'deal-1',
      dealName: '123 Main St Acquisition',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'high',
      type: 'follow-up',
      assignedTo: 'John Doe',
      createdAt: '2025-10-07T10:00:00Z'
    },
    {
      id: '2',
      title: 'Schedule property viewing',
      contactId: '2',
      contactName: 'Sarah Johnson',
      dueDate: '2025-10-09',
      status: 'pending',
      priority: 'medium',
      type: 'meeting',
      createdAt: '2025-10-07T11:00:00Z'
    },
    {
      id: '3',
      title: 'Call regarding duplex property then call her home to discuss next steps on 23rd street',
      contactId: '2',
      contactName: 'Sarah Johnson',
      dealId: 'deal-2',
      dealName: '456 Pine Ave Deal',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'high',
      type: 'call',
      assignedTo: 'John Doe',
      createdAt: '2025-10-06T14:00:00Z'
    },
    {
      id: '4',
      title: 'Send property investment analysis report',
      contactId: '3',
      contactName: 'Michael Chen',
      dealId: 'deal-3',
      dealName: 'Commercial Plaza Development',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'high',
      type: 'email',
      assignedTo: 'Jane Smith',
      createdAt: '2025-10-07T09:00:00Z'
    },
    {
      id: '5',
      title: 'Review and sign purchase agreement documents',
      contactId: '1',
      contactName: 'Emily Rodriguez',
      dealId: 'deal-1',
      dealName: '123 Main St Acquisition',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'high',
      type: 'document-review',
      assignedTo: 'John Doe',
      createdAt: '2025-10-07T08:30:00Z'
    },
    {
      id: '6',
      title: 'Follow up call after property tour',
      contactId: '4',
      contactName: 'David Park',
      dueDate: '2025-10-09',
      status: 'pending',
      priority: 'medium',
      type: 'call',
      assignedTo: 'Mike Johnson',
      createdAt: '2025-10-07T13:00:00Z'
    },
    {
      id: '7',
      title: 'Prepare closing documents for triplex sale',
      contactId: '5',
      contactName: 'Lisa Anderson',
      dealId: 'deal-4',
      dealName: 'Oakwood Triplex Sale',
      dueDate: '2025-10-10',
      status: 'pending',
      priority: 'high',
      type: 'active-deal',
      assignedTo: 'John Doe',
      createdAt: '2025-10-07T07:00:00Z'
    },
    {
      id: '8',
      title: 'Send updated market analysis and comparable properties in the area',
      contactId: '3',
      contactName: 'Michael Chen',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'medium',
      type: 'email',
      assignedTo: 'Jane Smith',
      createdAt: '2025-10-07T12:00:00Z'
    },
    {
      id: '9',
      title: 'Meeting with investor group about multifamily portfolio',
      contactId: '6',
      contactName: 'Robert Williams',
      dealId: 'deal-5',
      dealName: 'Downtown Apartments Portfolio',
      dueDate: '2025-10-09',
      status: 'pending',
      priority: 'high',
      type: 'meeting',
      assignedTo: 'John Doe',
      createdAt: '2025-10-07T06:00:00Z'
    },
    {
      id: '10',
      title: 'Call to discuss financing options',
      contactId: '2',
      contactName: 'Sarah Johnson',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'medium',
      type: 'call',
      assignedTo: 'Mike Johnson',
      createdAt: '2025-10-07T14:30:00Z'
    },
    {
      id: '11',
      title: 'Review title company paperwork and insurance quotes',
      contactId: '1',
      contactName: 'Emily Rodriguez',
      dealId: 'deal-1',
      dealName: '123 Main St Acquisition',
      dueDate: '2025-10-10',
      status: 'pending',
      priority: 'medium',
      type: 'document-review',
      assignedTo: 'John Doe',
      createdAt: '2025-10-07T15:00:00Z'
    },
    {
      id: '12',
      title: 'Follow up on cash offer for single family home on Elm Street',
      contactId: '7',
      contactName: 'Jennifer Martinez',
      dueDate: '2025-10-11',
      status: 'pending',
      priority: 'low',
      type: 'follow-up',
      assignedTo: 'Jane Smith',
      createdAt: '2025-10-07T16:00:00Z'
    },
    {
      id: '13',
      title: 'Send property inspection report and contractor estimates',
      contactId: '4',
      contactName: 'David Park',
      dueDate: '2025-10-08',
      status: 'pending',
      priority: 'high',
      type: 'email',
      assignedTo: 'Mike Johnson',
      createdAt: '2025-10-07T10:30:00Z'
    }
  ],
  
  taskTypes: [
    { id: 'task', label: 'Task', icon: '📋', color: '#6b7280' },
    { id: 'call', label: 'Call', icon: '📞', color: '#3b82f6' },
    { id: 'email', label: 'Email', icon: '📧', color: '#8b5cf6' },
    { id: 'meeting', label: 'Meeting', icon: '🤝', color: '#10b981' },
    { id: 'follow-up', label: 'Follow-up', icon: '🔄', color: '#f59e0b' },
    { id: 'active-deal', label: 'Active Deal', icon: '💼', color: '#ef4444' },
    { id: 'document-review', label: 'Document Review', icon: '📄', color: '#06b6d4' }
  ],

  addTask: (taskData) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    set((state) => ({
      tasks: [...state.tasks, newTask]
    }));
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map(task =>
        task.id === id ? { ...task, ...updates } : task
      )
    }));
  },

  deleteTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
  },

  toggleTaskStatus: (id) => {
    set((state) => ({
      tasks: state.tasks.map(task =>
        task.id === id
          ? {
              ...task,
              status: task.status === 'completed' ? 'pending' : 'completed',
              completedAt: task.status === 'completed' ? undefined : new Date().toISOString()
            }
          : task
      )
    }));
  },

  addTaskType: (taskType) => {
    const newTaskType: TaskTypeDefinition = {
      id: taskType.id || `type-${Date.now()}`,
      ...taskType
    };
    
    set((state) => ({
      taskTypes: [...state.taskTypes, newTaskType]
    }));
  },

  updateTaskType: (id, updates) => {
    set((state) => ({
      taskTypes: state.taskTypes.map(type =>
        type.id === id ? { ...type, ...updates } : type
      )
    }));
  },

  deleteTaskType: (id) => {
    // Don't allow deleting default types
    const defaultTypes = ['task', 'call', 'email', 'meeting', 'follow-up', 'active-deal', 'document-review'];
    if (defaultTypes.includes(id)) return;
    
    set((state) => ({
      taskTypes: state.taskTypes.filter(type => type.id !== id)
    }));
  },

  getTasksByContact: (contactId) => {
    return get().tasks.filter(task => task.contactId === contactId);
  },

  getTasksByDeal: (dealId) => {
    return get().tasks.filter(task => task.dealId === dealId);
  },

  getOverdueTasks: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().tasks.filter(task =>
      task.status === 'pending' && task.dueDate < today
    );
  },

  getUpcomingTasks: (days = 7) => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];
    
    return get().tasks.filter(task =>
      task.status === 'pending' &&
      task.dueDate >= todayStr &&
      task.dueDate <= futureStr
    );
  }
}),
    {
      name: 'adler-capital-tasks-storage',
      version: 1,
    }
  )
);

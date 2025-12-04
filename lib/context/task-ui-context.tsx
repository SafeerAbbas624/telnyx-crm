"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface Contact {
  id: string
  firstName?: string
  lastName?: string
  email1?: string
  phone1?: string
  propertyAddress?: string
}

export interface TaskSession {
  sessionId: string
  contact?: Contact | null
  contactId?: string
  isMinimized: boolean
  // Pre-fill values
  title?: string
  description?: string
  dueDate?: string
  priority?: string
  taskType?: string
  // Edit mode
  taskId?: string
  isEditMode?: boolean
}

interface TaskUIContextType {
  // Support for multiple sessions
  taskSessions: TaskSession[]
  // Legacy single-session support (returns first non-minimized or last session)
  taskSession: TaskSession | null
  openTask: (opts?: {
    contact?: Contact | null
    contactId?: string
    title?: string
    description?: string
    dueDate?: string
    priority?: string
    taskType?: string
    taskId?: string
    isEditMode?: boolean
  }) => void
  minimizeSession: (sessionId: string) => void
  maximizeSession: (sessionId: string) => void
  closeSession: (sessionId: string) => void
  // Legacy methods (operate on first session)
  minimize: () => void
  maximize: () => void
  close: () => void
}

const TaskUIContext = createContext<TaskUIContextType | null>(null)

export function TaskUIProvider({ children }: { children: ReactNode }) {
  const [taskSessions, setTaskSessions] = useState<TaskSession[]>([])

  const openTask = useCallback((opts?: {
    contact?: Contact | null
    contactId?: string
    title?: string
    description?: string
    dueDate?: string
    priority?: string
    taskType?: string
    taskId?: string
    isEditMode?: boolean
  }) => {
    const newSession: TaskSession = {
      sessionId: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contact: opts?.contact || null,
      contactId: opts?.contactId || opts?.contact?.id,
      isMinimized: false,
      title: opts?.title || '',
      description: opts?.description || '',
      dueDate: opts?.dueDate || '',
      priority: opts?.priority || 'medium',
      taskType: opts?.taskType || 'Follow Up',
      taskId: opts?.taskId,
      isEditMode: opts?.isEditMode || false,
    }
    setTaskSessions(prev => [...prev, newSession])
  }, [])

  const minimizeSession = useCallback((sessionId: string) => {
    setTaskSessions(prev => prev.map(s =>
      s.sessionId === sessionId ? { ...s, isMinimized: true } : s
    ))
  }, [])

  const maximizeSession = useCallback((sessionId: string) => {
    setTaskSessions(prev => prev.map(s =>
      s.sessionId === sessionId ? { ...s, isMinimized: false } : s
    ))
  }, [])

  const closeSession = useCallback((sessionId: string) => {
    setTaskSessions(prev => prev.filter(s => s.sessionId !== sessionId))
  }, [])

  // Legacy single-session methods
  const minimize = useCallback(() => {
    setTaskSessions(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isMinimized: true }
      return updated
    })
  }, [])

  const maximize = useCallback(() => {
    setTaskSessions(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isMinimized: false }
      return updated
    })
  }, [])

  const close = useCallback(() => {
    setTaskSessions(prev => prev.slice(0, -1))
  }, [])

  // Legacy taskSession - return last session or null
  const taskSession = taskSessions.length > 0 ? taskSessions[taskSessions.length - 1] : null

  return (
    <TaskUIContext.Provider value={{
      taskSessions,
      taskSession,
      openTask,
      minimizeSession,
      maximizeSession,
      closeSession,
      minimize,
      maximize,
      close
    }}>
      {children}
    </TaskUIContext.Provider>
  )
}

export function useTaskUI() {
  const context = useContext(TaskUIContext)
  if (!context) {
    throw new Error("useTaskUI must be used within a TaskUIProvider")
  }
  return context
}


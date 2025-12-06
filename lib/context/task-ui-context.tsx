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

// Props for opening the task modal
export interface TaskModalProps {
  contactId?: string
  contactName?: string
  subject?: string
  description?: string
  taskType?: string
  dueDate?: Date
  priority?: 'low' | 'medium' | 'high'
}

interface TaskUIContextType {
  // Modal state
  isOpen: boolean
  modalProps: TaskModalProps
  // Open modal with optional pre-filled values
  openTask: (opts?: {
    contact?: Contact | null
    contactId?: string
    title?: string
    subject?: string
    description?: string
    dueDate?: string | Date
    priority?: string
    taskType?: string
  }) => void
  // Close modal
  closeTask: () => void
  // Callback when task is created (for refreshing lists)
  onTaskCreated?: () => void
  setOnTaskCreated: (callback: (() => void) | undefined) => void
}

const TaskUIContext = createContext<TaskUIContextType | null>(null)

export function TaskUIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [modalProps, setModalProps] = useState<TaskModalProps>({})
  const [onTaskCreatedCallback, setOnTaskCreatedCallback] = useState<(() => void) | undefined>(undefined)

  const openTask = useCallback((opts?: {
    contact?: Contact | null
    contactId?: string
    title?: string
    subject?: string
    description?: string
    dueDate?: string | Date
    priority?: string
    taskType?: string
  }) => {
    // Build contact name from contact object if provided
    const contactName = opts?.contact
      ? `${opts.contact.firstName || ''} ${opts.contact.lastName || ''}`.trim()
      : undefined

    // Parse due date
    let parsedDueDate: Date | undefined
    if (opts?.dueDate) {
      parsedDueDate = opts.dueDate instanceof Date
        ? opts.dueDate
        : new Date(opts.dueDate)
    }

    setModalProps({
      contactId: opts?.contactId || opts?.contact?.id,
      contactName,
      subject: opts?.subject || opts?.title || '',
      description: opts?.description || '',
      taskType: opts?.taskType || 'Follow Up',
      dueDate: parsedDueDate,
      priority: (opts?.priority as 'low' | 'medium' | 'high') || 'low',
    })
    setIsOpen(true)
  }, [])

  const closeTask = useCallback(() => {
    setIsOpen(false)
    // Reset props after a short delay (for animation)
    setTimeout(() => setModalProps({}), 200)
  }, [])

  const setOnTaskCreated = useCallback((callback: (() => void) | undefined) => {
    setOnTaskCreatedCallback(() => callback)
  }, [])

  return (
    <TaskUIContext.Provider value={{
      isOpen,
      modalProps,
      openTask,
      closeTask,
      onTaskCreated: onTaskCreatedCallback,
      setOnTaskCreated,
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


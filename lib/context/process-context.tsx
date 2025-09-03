"use client"

import React, { createContext, useContext, useState } from "react"

export type ProcessType = "vapi" | "email" | "text"

export interface ActiveProcess {
  id: string
  type: ProcessType
  label: string
  progress: number
  total: number
  startTime: Date
  isPaused: boolean
}

interface ProcessContextType {
  activeProcesses: ActiveProcess[]
  addProcess: (process: Omit<ActiveProcess, "id" | "startTime">) => string
  updateProcess: (id: string, updates: Partial<ActiveProcess>) => void
  removeProcess: (id: string) => void
  pauseProcess: (id: string) => void
  resumeProcess: (id: string) => void
}

const ProcessContext = createContext<ProcessContextType | undefined>(undefined)

export function ProcessProvider({ children }: { children: React.ReactNode }) {
  const [activeProcesses, setActiveProcesses] = useState<ActiveProcess[]>([])

  const addProcess = (process: Omit<ActiveProcess, "id" | "startTime">) => {
    const id = `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newProcess: ActiveProcess = {
      ...process,
      id,
      startTime: new Date(),
    }
    setActiveProcesses((prev) => [...prev, newProcess])
    return id
  }

  const updateProcess = (id: string, updates: Partial<ActiveProcess>) => {
    setActiveProcesses((prev) => prev.map((process) => (process.id === id ? { ...process, ...updates } : process)))
  }

  const removeProcess = (id: string) => {
    setActiveProcesses((prev) => prev.filter((process) => process.id !== id))
  }

  const pauseProcess = (id: string) => {
    setActiveProcesses((prev) => prev.map((process) => (process.id === id ? { ...process, isPaused: true } : process)))
  }

  const resumeProcess = (id: string) => {
    setActiveProcesses((prev) => prev.map((process) => (process.id === id ? { ...process, isPaused: false } : process)))
  }

  return (
    <ProcessContext.Provider
      value={{
        activeProcesses,
        addProcess,
        updateProcess,
        removeProcess,
        pauseProcess,
        resumeProcess,
      }}
    >
      {children}
    </ProcessContext.Provider>
  )
}

export function useProcesses() {
  const context = useContext(ProcessContext)
  if (context === undefined) {
    throw new Error("useProcesses must be used within a ProcessProvider")
  }
  return context
}

"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { Activity } from "@/lib/types"

interface ActivitiesContextType {
  activities: Activity[]
  loading: boolean
  addActivity: (activity: Activity) => void
  updateActivity: (id: string, updates: Partial<Activity>) => Promise<void>
  deleteActivity: (id: string) => Promise<void>
  getContactActivities: (contactId: string) => Activity[]
  getUpcomingActivities: (days?: number) => Activity[]
  refreshActivities: () => Promise<void>
}

const ActivitiesContext = createContext<ActivitiesContextType | undefined>(undefined)

export function ActivitiesProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  // Load activities from API on initial render
  const refreshActivities = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/activities')
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      } else {
        console.error('Failed to fetch activities')
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshActivities()
  }, [])

  const addActivity = (activity: Activity) => {
    setActivities((prev) => [...prev, activity])
  }

  const updateActivity = async (id: string, updates: Partial<Activity>) => {
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedActivity = await response.json()
        setActivities((prev) => prev.map((activity) => (activity.id === id ? updatedActivity : activity)))
      } else {
        console.error('Failed to update activity')
      }
    } catch (error) {
      console.error('Error updating activity:', error)
    }
  }

  const deleteActivity = async (id: string) => {
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setActivities((prev) => prev.filter((activity) => activity.id !== id))
      } else {
        console.error('Failed to delete activity')
      }
    } catch (error) {
      console.error('Error deleting activity:', error)
    }
  }

  const getContactActivities = (contactId: string) => {
    return activities.filter((activity) => activity.contactId === contactId)
  }

  const getUpcomingActivities = (days = 7) => {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(now.getDate() + days)

    return activities
      .filter((activity) => {
        if (activity.status !== "planned") return false
        if (!activity.dueDate) return false

        const dueDate = new Date(activity.dueDate)
        return dueDate >= now && dueDate <= futureDate
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
  }

  return (
    <ActivitiesContext.Provider
      value={{
        activities,
        loading,
        addActivity,
        updateActivity,
        deleteActivity,
        getContactActivities,
        getUpcomingActivities,
        refreshActivities,
      }}
    >
      {children}
    </ActivitiesContext.Provider>
  )
}

export function useActivities() {
  const context = useContext(ActivitiesContext)
  if (context === undefined) {
    throw new Error("useActivities must be used within an ActivitiesProvider")
  }
  return context
}

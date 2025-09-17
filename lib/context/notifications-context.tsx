"use client"

import React, { createContext, useContext, useMemo, useRef, useState, useCallback, useEffect } from 'react'

export type NotificationItem = {
  id: string
  kind: 'sms' | 'email'
  contactId?: string
  contactName?: string
  preview?: string
  fromEmail?: string
  createdAt: string // ISO
  read: boolean
}

type Ctx = {
  items: NotificationItem[]
  unreadCount: number
  add: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & { createdAt?: string }) => void
  markAllRead: () => void
  markRead: (id: string) => void
  clear: () => void
}

const NotificationsContext = createContext<Ctx | null>(null)

const STORAGE_KEY = 'accrm.notifications.v1'

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: NotificationItem[] = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items])

  const add: Ctx['add'] = useCallback((n) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    setItems(prev => [{
      id,
      kind: n.kind,
      contactId: n.contactId,
      contactName: n.contactName,
      preview: n.preview,
      fromEmail: n.fromEmail,
      createdAt: n.createdAt || new Date().toISOString(),
      read: false,
    }, ...prev].slice(0, 200)) // cap history
  }, [])

  const markAllRead = useCallback(() => {
    setItems(prev => prev.map(i => ({ ...i, read: true })))
  }, [])

  const markRead = useCallback((id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => ({ items, unreadCount, add, markAllRead, markRead, clear }), [items, unreadCount, add, markAllRead, markRead, clear])

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}


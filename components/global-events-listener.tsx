"use client"

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { useNotifications } from '@/lib/context/notifications-context'

export default function GlobalEventsListener() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { add: addNotification } = useNotifications()

  useEffect(() => {
    // Mark global listener as active to avoid duplicate in-page toasts
    try { (window as any).__GLOBAL_SSE_ACTIVE = true } catch {}

    const es = new EventSource('/api/events')

    const isTeam = session?.user?.role === 'TEAM_USER' || session?.user?.role === 'TEAM_MEMBER' || session?.user?.role === 'TEAM'

    const checkAccess = async (contactId?: string) => {
      if (!isTeam) return true
      if (!contactId) return false
      try {
        const res = await fetch(`/api/contacts/${contactId}`)
        return res.ok
      } catch {
        return false
      }
    }

    const onInboundSms = async (evt: MessageEvent) => {
      let msg: any = null
      try { msg = JSON.parse(evt.data || '{}') } catch {}
      const contactId: string | undefined = msg?.contactId
      if (!(await checkAccess(contactId))) return

      const name = msg?.contactName || 'Unknown'
      const preview = (msg?.text || '').toString().slice(0, 60)

      addNotification({ kind: 'sms', contactId, contactName: name, preview })
      toast({
        title: `New message from ${name}`,
        description: preview || 'New SMS received',
        className: 'cursor-pointer',
        onClick: () => {
          if (contactId) {
            // Unified navigation - all users go to the same dashboard
            try {
              const url = new URL(window.location.href)
              url.pathname = '/dashboard'
              url.searchParams.set('section', 'messaging')
              url.searchParams.set('contactId', contactId)
              window.location.assign(url.toString())
            } catch {}
          }
        }
      })
    }

    const onInboundEmail = async (evt: MessageEvent) => {
      let em: any = null
      try { em = JSON.parse(evt.data || '{}') } catch {}
      const contactId: string | undefined = em?.contactId
      if (!(await checkAccess(contactId))) return

      const name = em?.contactName || em?.fromEmail || 'Unknown'
      const preview = (em?.subject || em?.preview || '').toString().slice(0, 80)

      addNotification({ kind: 'email', contactId, contactName: name, preview, fromEmail: em?.fromEmail })
      toast({
        title: `New email from ${name}`,
        description: preview || 'New email received',
        className: 'cursor-pointer',
        onClick: () => {
          if (contactId) {
            // Unified navigation - all users go to the same dashboard
            try {
              const url = new URL(window.location.href)
              url.pathname = '/dashboard'
              url.searchParams.set('section', 'email')
              url.searchParams.set('contactId', contactId)
              window.location.assign(url.toString())
            } catch {}
          }
        }
      })
    }

    es.addEventListener('inbound_sms', onInboundSms as any)
    es.addEventListener('inbound_email', onInboundEmail as any)

    es.onerror = () => { /* allow browser to auto-reconnect */ }

    return () => {
      try { es.removeEventListener('inbound_sms', onInboundSms as any) } catch {}
      try { es.removeEventListener('inbound_email', onInboundEmail as any) } catch {}
      try { es.close() } catch {}
      try { delete (window as any).__GLOBAL_SSE_ACTIVE } catch {}
    }
    // It's okay that session may change; listener stays global
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}


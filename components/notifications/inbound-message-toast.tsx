"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { MessageSquare, Mail, Phone } from "lucide-react"

interface InboundMessageToastProps {
  enabled?: boolean
  pollInterval?: number // ms
}

export default function InboundMessageToast({
  enabled = true,
  pollInterval = 5000 // Check every 5 seconds
}: InboundMessageToastProps) {
  const lastSmsCheckRef = useRef<string>(new Date().toISOString())
  const lastEmailCheckRef = useRef<string>(new Date().toISOString())

  useEffect(() => {
    if (!enabled) return

    // Check for new inbound SMS
    const checkNewSms = async () => {
      try {
        const since = lastSmsCheckRef.current
        const res = await fetch(`/api/telnyx/sms/inbound?since=${encodeURIComponent(since)}&limit=5`)
        if (!res.ok) return
        
        const data = await res.json()
        const messages = data.messages || []
        
        if (messages.length > 0) {
          // Update last check time
          lastSmsCheckRef.current = new Date().toISOString()
          
          // Show toast for each new message
          messages.forEach((msg: any) => {
            const contactName = msg.contact
              ? `${msg.contact.firstName || ''} ${msg.contact.lastName || ''}`.trim() || 'Unknown'
              : 'Unknown'
            
            toast.info(
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">New SMS from {contactName}</div>
                  <div className="text-xs text-muted-foreground truncate">{msg.body?.substring(0, 50)}...</div>
                </div>
              </div>,
              {
                duration: 3000,
                position: "top-right",
              }
            )
          })
        }
      } catch (error) {
        console.error("Error checking for new SMS:", error)
      }
    }

    // Check for new inbound emails
    const checkNewEmails = async () => {
      try {
        const since = lastEmailCheckRef.current
        const res = await fetch(`/api/email/inbound?since=${encodeURIComponent(since)}&limit=5`)
        if (!res.ok) return
        
        const data = await res.json()
        const emails = data.emails || []
        
        if (emails.length > 0) {
          // Update last check time
          lastEmailCheckRef.current = new Date().toISOString()
          
          // Show toast for each new email
          emails.forEach((email: any) => {
            toast.info(
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">New Email</div>
                  <div className="text-xs text-muted-foreground truncate">From: {email.from}</div>
                  <div className="text-xs text-muted-foreground truncate">{email.subject}</div>
                </div>
              </div>,
              {
                duration: 3000,
                position: "top-right",
              }
            )
          })
        }
      } catch (error) {
        console.error("Error checking for new emails:", error)
      }
    }

    // Initial check
    checkNewSms()
    checkNewEmails()

    // Set up polling
    const smsInterval = setInterval(checkNewSms, pollInterval)
    const emailInterval = setInterval(checkNewEmails, pollInterval)

    return () => {
      clearInterval(smsInterval)
      clearInterval(emailInterval)
    }
  }, [enabled, pollInterval])

  // This component doesn't render anything visible
  return null
}


import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface ActivityHistoryItem {
  id: string
  type: 'call' | 'sms' | 'email' | 'activity' | 'sequence' | 'tag_added' | 'tag_removed' | 'task'
  title: string
  description?: string
  direction?: 'inbound' | 'outbound'
  status?: string
  timestamp: string
  isPinned?: boolean
  activityId?: string // Original activity ID for pin/unpin operations
  metadata?: Record<string, any>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: contactId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Verify contact exists and user has access
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true }
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Fetch all activity types in parallel
    const [calls, messages, emails, activities, sequences, tagHistory] = await Promise.all([
      // Calls from TelnyxCall
      prisma.telnyxCall.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, direction: true, status: true, duration: true,
          callOutcome: true, callNotes: true, createdAt: true, fromNumber: true, toNumber: true
        }
      }),
      // SMS from TelnyxMessage
      prisma.telnyxMessage.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, direction: true, status: true, content: true, createdAt: true
        }
      }),
      // Emails from EmailMessage
      prisma.emailMessage.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, direction: true, status: true, subject: true, createdAt: true
        }
      }),
      // Activities (notes, meetings, etc.)
      prisma.activity.findMany({
        where: { contact_id: contactId },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true, type: true, title: true, description: true, status: true,
          created_at: true, completed_at: true, is_pinned: true
        }
      }),
      // Sequence enrollments
      prisma.sequenceEnrollment.findMany({
        where: { contactId },
        orderBy: { enrolledAt: 'desc' },
        take: limit,
        include: {
          sequence: { select: { name: true } }
        }
      }),
      // Tag history (additions and removals)
      prisma.contactTagHistory.findMany({
        where: { contact_id: contactId },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true, tag_name: true, action: true, created_at: true
        }
      })
    ])

    // Transform all items into unified format
    const historyItems: ActivityHistoryItem[] = []

    // Add calls
    calls.forEach(call => {
      historyItems.push({
        id: `call-${call.id}`,
        type: 'call',
        title: `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call`,
        description: call.callNotes || (call.duration ? `Duration: ${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : undefined),
        direction: call.direction as 'inbound' | 'outbound',
        status: call.callOutcome || call.status,
        timestamp: call.createdAt.toISOString(),
        metadata: { duration: call.duration, outcome: call.callOutcome }
      })
    })

    // Add SMS messages
    messages.forEach(msg => {
      historyItems.push({
        id: `sms-${msg.id}`,
        type: 'sms',
        title: `${msg.direction === 'inbound' ? 'Received' : 'Sent'} SMS`,
        description: msg.content?.substring(0, 100) + (msg.content && msg.content.length > 100 ? '...' : ''),
        direction: msg.direction as 'inbound' | 'outbound',
        status: msg.status,
        timestamp: msg.createdAt.toISOString()
      })
    })

    // Add emails
    emails.forEach(email => {
      historyItems.push({
        id: `email-${email.id}`,
        type: 'email',
        title: `${email.direction === 'inbound' ? 'Received' : 'Sent'} Email`,
        description: email.subject,
        direction: email.direction as 'inbound' | 'outbound',
        status: email.status,
        timestamp: email.createdAt.toISOString()
      })
    })

    // Add activities (notes, meetings, tasks)
    activities.forEach(activity => {
      historyItems.push({
        id: `activity-${activity.id}`,
        type: activity.type === 'task' ? 'task' : 'activity',
        title: activity.title,
        description: activity.description || undefined,
        status: activity.status,
        timestamp: activity.created_at.toISOString(),
        isPinned: activity.is_pinned,
        activityId: activity.id,
        metadata: { activityType: activity.type, completedAt: activity.completed_at }
      })
    })

    // Add sequence enrollments
    sequences.forEach(seq => {
      historyItems.push({
        id: `sequence-${seq.id}`,
        type: 'sequence',
        title: `Enrolled in sequence: ${seq.sequence.name}`,
        status: seq.status,
        timestamp: seq.enrolledAt.toISOString(),
        metadata: { sequenceId: seq.sequenceId, currentStep: seq.currentStepIndex }
      })
    })

    // Add tag history (additions and removals)
    tagHistory.forEach(th => {
      historyItems.push({
        id: `tag-${th.id}`,
        type: th.action === 'added' ? 'tag_added' : 'tag_removed',
        title: th.action === 'added' ? `Tag added: ${th.tag_name}` : `Tag removed: ${th.tag_name}`,
        timestamp: th.created_at.toISOString(),
        metadata: { tagName: th.tag_name, action: th.action }
      })
    })

    // Sort all items by timestamp descending
    historyItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Limit total results
    const limitedItems = historyItems.slice(0, limit)

    return NextResponse.json({ items: limitedItems, total: historyItems.length })
  } catch (error) {
    console.error('Error fetching activity history:', error)
    return NextResponse.json({ error: 'Failed to fetch activity history' }, { status: 500 })
  }
}


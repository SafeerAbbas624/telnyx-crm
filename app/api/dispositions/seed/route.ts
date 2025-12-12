import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * POST /api/dispositions/seed
 * Create default dispositions if they don't exist
 */
export async function POST() {
  try {
    const defaultDispositions = [
      {
        name: 'Interested',
        description: 'Contact showed interest',
        color: '#22c55e',
        icon: 'ThumbsUp',
        sortOrder: 1,
        actions: [
          { actionType: 'ADD_TAG', config: { tagName: 'Interested' } }
        ]
      },
      {
        name: 'Not Interested',
        description: 'Contact not interested - adds to DNC and tags',
        color: '#ef4444',
        icon: 'ThumbsDown',
        sortOrder: 2,
        actions: [
          { actionType: 'ADD_TO_DNC', config: { reason: 'Not interested' } },
          { actionType: 'ADD_TAG', config: { tagName: 'Not Interested' } }
        ]
      },
      {
        name: 'Callback',
        description: 'Contact requested callback',
        color: '#3b82f6',
        icon: 'Calendar',
        sortOrder: 3,
        actions: [
          { actionType: 'ADD_TAG', config: { tagName: 'Callback' } },
          { actionType: 'CREATE_TASK', config: { taskTitle: 'Callback requested', taskDueInDays: 1 } }
        ]
      },
      {
        name: 'No Answer',
        description: 'Contact did not answer - requeues back into the queue for retry',
        color: '#f97316',
        icon: 'PhoneMissed',
        sortOrder: 4,
        actions: [
          { actionType: 'REQUEUE_CONTACT', config: { delayMinutes: 30 } }
        ]
      },
      {
        name: 'Voicemail',
        description: 'Left voicemail - requeues for follow-up call',
        color: '#8b5cf6',
        icon: 'Voicemail',
        sortOrder: 5,
        actions: [
          { actionType: 'REQUEUE_CONTACT', config: { delayMinutes: 60 } }
        ]
      },
      {
        name: 'Wrong Number',
        description: 'Wrong number or disconnected',
        color: '#6b7280',
        icon: 'PhoneOff',
        sortOrder: 6,
        actions: [
          { actionType: 'ADD_TAG', config: { tagName: 'Wrong Number' } }
        ]
      },
      {
        name: 'Do Not Call',
        description: 'Contact requested to not be called',
        color: '#000000',
        icon: 'Ban',
        sortOrder: 7,
        actions: [
          { actionType: 'ADD_TO_DNC', config: { reason: 'Requested via phone' } },
          { actionType: 'ADD_TAG', config: { tagName: 'DNC' } }
        ]
      },
      {
        name: 'Bad Number',
        description: 'Wrong person or invalid number - adds to DNC',
        color: '#991b1b',
        icon: 'UserX',
        sortOrder: 8,
        actions: [
          { actionType: 'ADD_TO_DNC', config: { reason: 'Bad number - wrong person' } },
          { actionType: 'ADD_TAG', config: { tagName: 'Bad Number' } }
        ]
      },
      {
        name: 'Future Opportunity',
        description: 'Not ready now - nurture for future. Sends text, email, and adds to nurture sequence',
        color: '#0891b2',
        icon: 'Clock',
        sortOrder: 9,
        actions: [
          { actionType: 'SEND_SMS', config: { smsMessage: 'Hi {firstName}, thanks for chatting! I\'ll keep you in mind for future opportunities. Feel free to reach out anytime. - Adler Capital' } },
          { actionType: 'SEND_EMAIL', config: { emailSubject: 'Great connecting with you, {firstName}!', emailBody: 'Hi {firstName},\n\nIt was great speaking with you today. I understand the timing isn\'t right at the moment, but I\'d love to stay in touch for when the right opportunity comes along.\n\nFeel free to reach out anytime if your situation changes or if you have any questions.\n\nBest regards,\nAdler Capital' } },
          { actionType: 'TRIGGER_SEQUENCE', config: { sequenceName: 'Nurture Sequence' } },
          { actionType: 'ADD_TAG', config: { tagName: 'Nurture' } }
        ]
      }
    ]

    const created: string[] = []
    const updated: string[] = []

    for (const dispo of defaultDispositions) {
      const existing = await prisma.callDisposition.findUnique({
        where: { name: dispo.name },
        include: { actions: true }
      })

      if (existing) {
        // Update existing disposition - delete old actions and create new ones
        // This ensures the latest actions are applied
        await prisma.callDispositionAction.deleteMany({
          where: { dispositionId: existing.id }
        })

        await prisma.callDisposition.update({
          where: { id: existing.id },
          data: {
            description: dispo.description,
            color: dispo.color,
            icon: dispo.icon,
            sortOrder: dispo.sortOrder,
            actions: {
              create: dispo.actions.map((action, index) => ({
                actionType: action.actionType as 'ADD_TAG' | 'REMOVE_TAG' | 'ADD_TO_DNC' | 'REMOVE_FROM_DNC' | 'TRIGGER_SEQUENCE' | 'SEND_SMS' | 'SEND_EMAIL' | 'UPDATE_DEAL_STAGE' | 'CREATE_TASK' | 'REQUEUE_CONTACT' | 'REMOVE_FROM_QUEUE' | 'MARK_BAD_NUMBER',
                config: action.config,
                sortOrder: index
              }))
            }
          }
        })
        updated.push(dispo.name)
        continue
      }

      await prisma.callDisposition.create({
        data: {
          name: dispo.name,
          description: dispo.description,
          color: dispo.color,
          icon: dispo.icon,
          sortOrder: dispo.sortOrder,
          isDefault: true,
          actions: {
            create: dispo.actions.map((action, index) => ({
              actionType: action.actionType as 'ADD_TAG' | 'REMOVE_TAG' | 'ADD_TO_DNC' | 'REMOVE_FROM_DNC' | 'TRIGGER_SEQUENCE' | 'SEND_SMS' | 'SEND_EMAIL' | 'UPDATE_DEAL_STAGE' | 'CREATE_TASK' | 'REQUEUE_CONTACT' | 'REMOVE_FROM_QUEUE' | 'MARK_BAD_NUMBER',
              config: action.config,
              sortOrder: index
            }))
          }
        }
      })
      created.push(dispo.name)
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      message: `Created ${created.length} dispositions, updated ${updated.length} existing`
    })
  } catch (error) {
    console.error('[Dispositions Seed] Error:', error)
    return NextResponse.json(
      { error: 'Failed to seed dispositions' },
      { status: 500 }
    )
  }
}


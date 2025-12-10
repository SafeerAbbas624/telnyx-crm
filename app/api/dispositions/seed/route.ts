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
        description: 'Contact not interested',
        color: '#ef4444',
        icon: 'ThumbsDown',
        sortOrder: 2,
        actions: [
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
        description: 'Contact did not answer',
        color: '#f97316',
        icon: 'PhoneMissed',
        sortOrder: 4,
        actions: []
      },
      {
        name: 'Voicemail',
        description: 'Left voicemail',
        color: '#8b5cf6',
        icon: 'Voicemail',
        sortOrder: 5,
        actions: []
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
      }
    ]

    const created: string[] = []
    const skipped: string[] = []

    for (const dispo of defaultDispositions) {
      const existing = await prisma.callDisposition.findUnique({
        where: { name: dispo.name }
      })

      if (existing) {
        skipped.push(dispo.name)
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
              actionType: action.actionType as 'ADD_TAG' | 'REMOVE_TAG' | 'ADD_TO_DNC' | 'REMOVE_FROM_DNC' | 'TRIGGER_SEQUENCE' | 'SEND_SMS' | 'SEND_EMAIL' | 'UPDATE_DEAL_STAGE' | 'CREATE_TASK',
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
      skipped,
      message: `Created ${created.length} dispositions, skipped ${skipped.length} existing`
    })
  } catch (error) {
    console.error('[Dispositions Seed] Error:', error)
    return NextResponse.json(
      { error: 'Failed to seed dispositions' },
      { status: 500 }
    )
  }
}


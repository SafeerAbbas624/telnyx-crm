import prisma from '@/lib/prisma'

export interface PostCallAutomationRule {
  id: string
  name: string
  trigger: 'call_outcome' | 'sentiment' | 'duration'
  triggerValue: string
  actions: PostCallAction[]
  enabled: boolean
}

export interface PostCallAction {
  type: 'create_task' | 'send_email' | 'add_tag' | 'update_deal' | 'create_activity'
  config: Record<string, any>
}

/**
 * Execute post-call automation based on call outcome and sentiment
 */
export async function executePostCallAutomation(
  callId: string,
  callType: 'telnyx' | 'vapi' | 'power_dialer',
  contactId: string | null,
  userId: string
) {
  if (!contactId) return

  try {
    // Get call details
    let call: any = null

    if (callType === 'telnyx') {
      call = await prisma.telnyxCall.findUnique({
        where: { id: callId },
        select: {
          callOutcome: true,
          sentiment: true,
          duration: true,
          contact: { select: { id: true, email1: true } },
        },
      })
    } else if (callType === 'vapi') {
      call = await prisma.vapiCall.findUnique({
        where: { id: callId },
        select: {
          callOutcome: true,
          sentiment: true,
          duration: true,
        },
      })
    } else if (callType === 'power_dialer') {
      call = await prisma.powerDialerCall.findUnique({
        where: { id: callId },
        select: {
          callOutcome: true,
          sentiment: true,
          duration: true,
          contact: { select: { id: true, email1: true } },
        },
      })
    }

    if (!call) return

    // Execute automation based on outcome
    if (call.callOutcome === 'interested') {
      await handleInterestedOutcome(contactId, userId)
    } else if (call.callOutcome === 'callback') {
      await handleCallbackOutcome(contactId, userId)
    } else if (call.callOutcome === 'not_interested') {
      await handleNotInterestedOutcome(contactId, userId)
    }

    // Execute automation based on sentiment
    if (call.sentiment === 'positive') {
      await handlePositiveSentiment(contactId, userId)
    } else if (call.sentiment === 'negative') {
      await handleNegativeSentiment(contactId, userId)
    }

    // Mark automation as triggered
    if (callType === 'telnyx') {
      await prisma.telnyxCall.update({
        where: { id: callId },
        data: { automationTriggered: true },
      })
    } else if (callType === 'vapi') {
      await prisma.vapiCall.update({
        where: { id: callId },
        data: { automationTriggered: true },
      })
    } else if (callType === 'power_dialer') {
      await prisma.powerDialerCall.update({
        where: { id: callId },
        data: { automationTriggered: true },
      })
    }
  } catch (error) {
    console.error('Error executing post-call automation:', error)
  }
}

/**
 * Handle "Interested" outcome
 */
async function handleInterestedOutcome(contactId: string, userId: string) {
  try {
    // Add "interested" tag
    const tag = await prisma.tag.findUnique({
      where: { name: 'interested' },
    })

    if (tag) {
      await prisma.contactTag.upsert({
        where: {
          contact_id_tag_id: {
            contact_id: contactId,
            tag_id: tag.id,
          },
        },
        update: {},
        create: {
          contact_id: contactId,
          tag_id: tag.id,
          created_by: userId,
        },
      })
    }

    // Create follow-up task for tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    await prisma.activity.create({
      data: {
        contact_id: contactId,
        type: 'call',
        title: 'Follow-up call - Interested lead',
        description: 'Contact expressed interest. Schedule follow-up call.',
        status: 'planned',
        due_date: tomorrow,
        created_by: userId,
      },
    })

    // Update contact deal status if not already set
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { deal_status: true },
    })

    if (contact?.deal_status === 'new') {
      await prisma.contact.update({
        where: { id: contactId },
        data: { deal_status: 'qualified' },
      })
    }
  } catch (error) {
    console.error('Error handling interested outcome:', error)
  }
}

/**
 * Handle "Callback" outcome
 */
async function handleCallbackOutcome(contactId: string, userId: string) {
  try {
    // Add "callback" tag
    const tag = await prisma.tag.findUnique({
      where: { name: 'callback' },
    })

    if (tag) {
      await prisma.contactTag.upsert({
        where: {
          contact_id_tag_id: {
            contact_id: contactId,
            tag_id: tag.id,
          },
        },
        update: {},
        create: {
          contact_id: contactId,
          tag_id: tag.id,
          created_by: userId,
        },
      })
    }

    // Create reminder activity
    const inThreeDays = new Date()
    inThreeDays.setDate(inThreeDays.getDate() + 3)
    inThreeDays.setHours(10, 0, 0, 0)

    await prisma.activity.create({
      data: {
        contact_id: contactId,
        type: 'call',
        title: 'Callback reminder',
        description: 'Contact requested callback. Call them back.',
        status: 'planned',
        due_date: inThreeDays,
        created_by: userId,
      },
    })
  } catch (error) {
    console.error('Error handling callback outcome:', error)
  }
}

/**
 * Handle "Not Interested" outcome
 */
async function handleNotInterestedOutcome(contactId: string, userId: string) {
  try {
    // Add "not_interested" tag
    const tag = await prisma.tag.findUnique({
      where: { name: 'not_interested' },
    })

    if (tag) {
      await prisma.contactTag.upsert({
        where: {
          contact_id_tag_id: {
            contact_id: contactId,
            tag_id: tag.id,
          },
        },
        update: {},
        create: {
          contact_id: contactId,
          tag_id: tag.id,
          created_by: userId,
        },
      })
    }

    // Update contact status
    await prisma.contact.update({
      where: { id: contactId },
      data: { deal_status: 'not_interested' },
    })
  } catch (error) {
    console.error('Error handling not interested outcome:', error)
  }
}

/**
 * Handle positive sentiment
 */
async function handlePositiveSentiment(contactId: string, userId: string) {
  try {
    // Add "positive_sentiment" tag
    const tag = await prisma.tag.findUnique({
      where: { name: 'positive_sentiment' },
    })

    if (tag) {
      await prisma.contactTag.upsert({
        where: {
          contact_id_tag_id: {
            contact_id: contactId,
            tag_id: tag.id,
          },
        },
        update: {},
        create: {
          contact_id: contactId,
          tag_id: tag.id,
          created_by: userId,
        },
      })
    }
  } catch (error) {
    console.error('Error handling positive sentiment:', error)
  }
}

/**
 * Handle negative sentiment
 */
async function handleNegativeSentiment(contactId: string, userId: string) {
  try {
    // Add "negative_sentiment" tag
    const tag = await prisma.tag.findUnique({
      where: { name: 'negative_sentiment' },
    })

    if (tag) {
      await prisma.contactTag.upsert({
        where: {
          contact_id_tag_id: {
            contact_id: contactId,
            tag_id: tag.id,
          },
        },
        update: {},
        create: {
          contact_id: contactId,
          tag_id: tag.id,
          created_by: userId,
        },
      })
    }

    // Create note for team
    await prisma.activity.create({
      data: {
        contact_id: contactId,
        type: 'note',
        title: 'Negative sentiment detected',
        description: 'Call sentiment analysis detected negative sentiment. Review call notes.',
        status: 'planned',
        created_by: userId,
      },
    })
  } catch (error) {
    console.error('Error handling negative sentiment:', error)
  }
}


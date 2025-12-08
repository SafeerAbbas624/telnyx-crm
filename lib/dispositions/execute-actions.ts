import { prisma } from '@/lib/prisma'
import type { DispositionActionType } from '@prisma/client'

interface ActionConfig {
  tagId?: string
  tagName?: string
  reason?: string
  sequenceId?: string
  templateId?: string
  phoneNumberId?: string
  dealStage?: string
  taskTitle?: string
  taskDescription?: string
  taskDueInDays?: number
}

interface ActionResult {
  actionType: DispositionActionType
  success: boolean
  error?: string
  details?: Record<string, unknown>
}

interface ActionContext {
  listId?: string
  dialerRunId?: string
  legId?: string
  listEntryId?: string // For requeue operations
}

interface DispositionAction {
  id: string
  actionType: DispositionActionType
  config: ActionConfig | unknown
}

/**
 * Execute all disposition actions for a contact
 */
export async function executeDispositionActions(
  actions: DispositionAction[],
  contactId: string,
  context: ActionContext
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const action of actions) {
    try {
      const config = action.config as ActionConfig
      let result: ActionResult

      switch (action.actionType) {
        case 'ADD_TAG':
          result = await addTag(contactId, config)
          break
        case 'REMOVE_TAG':
          result = await removeTag(contactId, config)
          break
        case 'ADD_TO_DNC':
          result = await addToDnc(contactId, config)
          break
        case 'REMOVE_FROM_DNC':
          result = await removeFromDnc(contactId)
          break
        case 'TRIGGER_SEQUENCE':
          result = await triggerSequence(contactId, config)
          break
        case 'SEND_SMS':
          result = await sendSms(contactId, config)
          break
        case 'SEND_EMAIL':
          result = await sendEmail(contactId, config)
          break
        case 'CREATE_TASK':
          result = await createTask(contactId, config)
          break
        case 'REQUEUE_CONTACT':
          result = await requeueContact(contactId, config, context)
          break
        case 'REMOVE_FROM_QUEUE':
          result = await removeFromQueue(contactId, context)
          break
        case 'MARK_BAD_NUMBER':
          result = await markBadNumber(contactId, config)
          break
        default:
          result = { actionType: action.actionType, success: false, error: 'Unknown action type' }
      }
      results.push(result)
    } catch (error) {
      results.push({
        actionType: action.actionType,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

async function addTag(contactId: string, config: ActionConfig): Promise<ActionResult> {
  let tagId = config.tagId
  
  // If tagName provided but no tagId, find or create tag
  if (!tagId && config.tagName) {
    const tag = await prisma.tag.upsert({
      where: { name: config.tagName },
      update: {},
      create: { name: config.tagName, color: '#3b82f6' }
    })
    tagId = tag.id
  }

  if (!tagId) {
    return { actionType: 'ADD_TAG', success: false, error: 'No tag specified' }
  }

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId, tagId } },
    update: {},
    create: { contactId, tagId }
  })

  return { actionType: 'ADD_TAG', success: true, details: { tagId } }
}

async function removeTag(contactId: string, config: ActionConfig): Promise<ActionResult> {
  let tagId = config.tagId
  
  if (!tagId && config.tagName) {
    const tag = await prisma.tag.findUnique({ where: { name: config.tagName } })
    tagId = tag?.id
  }

  if (!tagId) {
    return { actionType: 'REMOVE_TAG', success: false, error: 'Tag not found' }
  }

  await prisma.contactTag.deleteMany({
    where: { contactId, tagId }
  })

  return { actionType: 'REMOVE_TAG', success: true, details: { tagId } }
}

async function addToDnc(contactId: string, config: ActionConfig): Promise<ActionResult> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { dnc: true, dncReason: config.reason || 'Added via disposition' }
  })
  return { actionType: 'ADD_TO_DNC', success: true }
}

async function removeFromDnc(contactId: string): Promise<ActionResult> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { dnc: false, dncReason: null }
  })
  return { actionType: 'REMOVE_FROM_DNC', success: true }
}

async function triggerSequence(contactId: string, config: ActionConfig): Promise<ActionResult> {
  if (!config.sequenceId) {
    return { actionType: 'TRIGGER_SEQUENCE', success: false, error: 'No sequence specified' }
  }
  // Check if already enrolled
  const existing = await prisma.sequenceEnrollment.findFirst({
    where: { contactId, sequenceId: config.sequenceId, status: { in: ['active', 'paused'] } }
  })
  if (existing) {
    return { actionType: 'TRIGGER_SEQUENCE', success: true, details: { alreadyEnrolled: true } }
  }
  // Enroll in sequence
  await prisma.sequenceEnrollment.create({
    data: { contactId, sequenceId: config.sequenceId, status: 'active', currentStepIndex: 0 }
  })
  return { actionType: 'TRIGGER_SEQUENCE', success: true, details: { sequenceId: config.sequenceId } }
}

async function sendSms(contactId: string, config: ActionConfig): Promise<ActionResult> {
  if (!config.templateId) {
    return { actionType: 'SEND_SMS', success: false, error: 'No SMS template specified' }
  }
  // Schedule the SMS for immediate send
  await prisma.scheduledMessage.create({
    data: {
      contactId,
      channel: 'sms',
      status: 'pending',
      scheduledAt: new Date(),
      metadata: { templateId: config.templateId, phoneNumberId: config.phoneNumberId, source: 'disposition' }
    }
  })
  return { actionType: 'SEND_SMS', success: true, details: { templateId: config.templateId } }
}

async function sendEmail(contactId: string, config: ActionConfig): Promise<ActionResult> {
  if (!config.templateId) {
    return { actionType: 'SEND_EMAIL', success: false, error: 'No email template specified' }
  }
  // Schedule the email for immediate send
  await prisma.scheduledMessage.create({
    data: {
      contactId,
      channel: 'email',
      status: 'pending',
      scheduledAt: new Date(),
      metadata: { templateId: config.templateId, source: 'disposition' }
    }
  })
  return { actionType: 'SEND_EMAIL', success: true, details: { templateId: config.templateId } }
}

async function createTask(contactId: string, config: ActionConfig): Promise<ActionResult> {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (config.taskDueInDays || 1))

  await prisma.task.create({
    data: {
      title: config.taskTitle || 'Follow up',
      description: config.taskDescription,
      type: 'follow_up',
      status: 'pending',
      priority: 'medium',
      dueDate,
      contactId
    }
  })
  return { actionType: 'CREATE_TASK', success: true }
}

async function requeueContact(contactId: string, config: ActionConfig, context: ActionContext): Promise<ActionResult> {
  // Requeue the contact by resetting status to 'pending' with a delay
  const delayMinutes = (config as any).delayMinutes || 30
  const nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000)

  if (context.listId) {
    // Reset status in the specific list
    await prisma.powerDialerListContact.updateMany({
      where: { contactId, listId: context.listId },
      data: {
        status: 'pending',
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 }
      }
    })
  } else {
    // Reset all list entries for this contact
    await prisma.powerDialerListContact.updateMany({
      where: { contactId },
      data: {
        status: 'pending',
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 }
      }
    })
  }

  return { actionType: 'REQUEUE_CONTACT', success: true, details: { delayMinutes } }
}

async function removeFromQueue(contactId: string, context: ActionContext): Promise<ActionResult> {
  if (context.listId) {
    // Remove from specific list
    await prisma.powerDialerListContact.updateMany({
      where: { contactId, listId: context.listId },
      data: { status: 'removed' }
    })
  } else {
    // Remove from all lists
    await prisma.powerDialerListContact.updateMany({
      where: { contactId },
      data: { status: 'removed' }
    })
  }

  return { actionType: 'REMOVE_FROM_QUEUE', success: true }
}

async function markBadNumber(contactId: string, config: ActionConfig): Promise<ActionResult> {
  // Mark the primary phone as bad
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      phone1Valid: false,
      phone1InvalidReason: config.reason || 'Marked as bad via disposition'
    }
  })

  // Also remove from all queues
  await prisma.powerDialerListContact.updateMany({
    where: { contactId },
    data: { status: 'bad_number' }
  })

  return { actionType: 'MARK_BAD_NUMBER', success: true }
}


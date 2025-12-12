import { prisma } from '@/lib/db'
import type { DispositionActionType } from '@prisma/client'

interface ActionConfig {
  tagId?: string
  tagName?: string
  reason?: string
  sequenceId?: string
  sequenceName?: string // Alternative to sequenceId - find by name
  templateId?: string
  phoneNumberId?: string
  dealStage?: string
  taskTitle?: string
  taskDescription?: string
  taskDueInDays?: number
  taskDueTime?: string // e.g., "09:00" for 9am
  taskPriority?: 'low' | 'medium' | 'high' | 'urgent'
  taskType?: string // call, email, meeting, follow_up, other
  assignToUserId?: string
  delayMinutes?: number
  // Inline message content (alternative to templateId)
  smsMessage?: string
  emailSubject?: string
  emailBody?: string
  // Remove from queue scope
  scope?: 'current' | 'all'
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
  callerIdNumber?: string // The phone number used to make the call (for SMS from same number)
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
          result = await sendSms(contactId, config, context)
          break
        case 'SEND_EMAIL':
          result = await sendEmail(contactId, config, context)
          break
        case 'CREATE_TASK':
          result = await createTask(contactId, config)
          break
        case 'REQUEUE_CONTACT':
          result = await requeueContact(contactId, config, context)
          break
        case 'REMOVE_FROM_QUEUE':
          result = await removeFromQueue(contactId, config, context)
          break
        case 'MARK_BAD_NUMBER':
          result = await markBadNumber(contactId, config)
          break
        case 'DELETE_CONTACT':
          result = await deleteContact(contactId)
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

  // Schema uses snake_case: contact_id, tag_id
  await prisma.contactTag.upsert({
    where: { contact_id_tag_id: { contact_id: contactId, tag_id: tagId } },
    update: {},
    create: { contact_id: contactId, tag_id: tagId }
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

  // Schema uses snake_case: contact_id, tag_id
  await prisma.contactTag.deleteMany({
    where: { contact_id: contactId, tag_id: tagId }
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
  let sequenceId = config.sequenceId

  // If sequenceName is provided, find the sequence by name
  if (!sequenceId && config.sequenceName) {
    const sequence = await prisma.sequence.findFirst({
      where: { name: { equals: config.sequenceName, mode: 'insensitive' } }
    })
    if (sequence) {
      sequenceId = sequence.id
    } else {
      return { actionType: 'TRIGGER_SEQUENCE', success: false, error: `Sequence "${config.sequenceName}" not found` }
    }
  }

  if (!sequenceId) {
    return { actionType: 'TRIGGER_SEQUENCE', success: false, error: 'No sequence specified' }
  }
  // Check if already enrolled
  const existing = await prisma.sequenceEnrollment.findFirst({
    where: { contactId, sequenceId, status: { in: ['active', 'paused'] } }
  })
  if (existing) {
    return { actionType: 'TRIGGER_SEQUENCE', success: true, details: { alreadyEnrolled: true } }
  }
  // Enroll in sequence
  await prisma.sequenceEnrollment.create({
    data: { contactId, sequenceId, status: 'active', currentStepIndex: 0 }
  })
  return { actionType: 'TRIGGER_SEQUENCE', success: true, details: { sequenceId } }
}

async function sendSms(contactId: string, config: ActionConfig, context: ActionContext): Promise<ActionResult> {
  if (!config.templateId && !config.smsMessage) {
    return { actionType: 'SEND_SMS', success: false, error: 'No SMS template or message specified' }
  }

  // Get contact info for variable replacement
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true, phone1: true, email1: true, llcName: true, propertyAddress: true }
  })

  if (!contact?.phone1) {
    return { actionType: 'SEND_SMS', success: false, error: 'Contact has no phone number' }
  }

  // Replace variables in message
  const replaceVars = (text: string | undefined) => {
    if (!text) return text
    return text
      .replace(/\{firstName\}/gi, contact?.firstName || '')
      .replace(/\{lastName\}/gi, contact?.lastName || '')
      .replace(/\{phone\}/gi, contact?.phone1 || '')
      .replace(/\{email\}/gi, contact?.email1 || '')
      .replace(/\{llcName\}/gi, contact?.llcName || '')
      .replace(/\{companyName\}/gi, contact?.llcName || '')
      .replace(/\{propertyAddress\}/gi, contact?.propertyAddress || '')
      .replace(/\{address\}/gi, contact?.propertyAddress || '')
  }

  // Get message body from template or inline message
  let messageBody = ''
  if (config.templateId) {
    const template = await prisma.messageTemplate.findUnique({
      where: { id: config.templateId }
    })
    if (template) {
      messageBody = replaceVars(template.content) || ''
    }
  } else if (config.smsMessage) {
    messageBody = replaceVars(config.smsMessage) || ''
  }

  if (!messageBody) {
    return { actionType: 'SEND_SMS', success: false, error: 'No message body (template not found or empty)' }
  }

  // Calculate scheduled time with optional delay
  const delayMs = (config.delayMinutes || 0) * 60 * 1000
  const scheduledAt = new Date(Date.now() + delayMs)

  // Use callerIdNumber from context if available (send from same number we called from)
  const fromNumber = context.callerIdNumber || config.phoneNumberId

  if (!fromNumber) {
    return { actionType: 'SEND_SMS', success: false, error: 'No from number specified' }
  }

  await prisma.scheduledMessage.create({
    data: {
      contactId,
      channel: 'SMS',
      status: 'PENDING',
      scheduledAt,
      fromNumber,
      toNumber: contact.phone1,
      body: messageBody,
      metadata: {
        templateId: config.templateId,
        source: 'disposition'
      }
    }
  })
  return { actionType: 'SEND_SMS', success: true, details: { templateId: config.templateId, delayMinutes: config.delayMinutes, fromNumber, toNumber: contact.phone1 } }
}

async function sendEmail(contactId: string, config: ActionConfig, context: ActionContext): Promise<ActionResult> {
  if (!config.templateId && !config.emailBody) {
    return { actionType: 'SEND_EMAIL', success: false, error: 'No email template or body specified' }
  }

  // Get contact info for variable replacement
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true, phone1: true, email1: true, llcName: true, propertyAddress: true }
  })

  if (!contact?.email1) {
    return { actionType: 'SEND_EMAIL', success: false, error: 'Contact has no email address' }
  }

  // Replace variables in message
  const replaceVars = (text: string | undefined) => {
    if (!text) return text
    return text
      .replace(/\{firstName\}/gi, contact?.firstName || '')
      .replace(/\{lastName\}/gi, contact?.lastName || '')
      .replace(/\{phone\}/gi, contact?.phone1 || '')
      .replace(/\{email\}/gi, contact?.email1 || '')
      .replace(/\{llcName\}/gi, contact?.llcName || '')
      .replace(/\{companyName\}/gi, contact?.llcName || '')
      .replace(/\{propertyAddress\}/gi, contact?.propertyAddress || '')
      .replace(/\{address\}/gi, contact?.propertyAddress || '')
  }

  // Get email content from template or inline
  let emailSubject = ''
  let emailBody = ''
  let fromEmail = ''

  if (config.templateId) {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: config.templateId }
    })
    if (template) {
      emailSubject = replaceVars(template.subject) || ''
      emailBody = replaceVars(template.content) || ''
    }
  } else {
    emailSubject = replaceVars(config.emailSubject) || ''
    emailBody = replaceVars(config.emailBody) || ''
  }

  if (!emailBody) {
    return { actionType: 'SEND_EMAIL', success: false, error: 'No email body (template not found or empty)' }
  }

  if (!emailSubject) {
    emailSubject = 'Message from Adler Capital'
  }

  // Get the default email account
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { isDefault: true },
    select: { emailAddress: true }
  })

  fromEmail = emailAccount?.emailAddress || ''
  if (!fromEmail) {
    return { actionType: 'SEND_EMAIL', success: false, error: 'No default email account configured' }
  }

  // Calculate scheduled time with optional delay
  const delayMs = (config.delayMinutes || 0) * 60 * 1000
  const scheduledAt = new Date(Date.now() + delayMs)

  await prisma.scheduledMessage.create({
    data: {
      contactId,
      channel: 'EMAIL',
      status: 'PENDING',
      scheduledAt,
      fromEmail,
      toEmail: contact.email1,
      subject: emailSubject,
      body: emailBody,
      metadata: {
        templateId: config.templateId,
        source: 'disposition'
      }
    }
  })
  return { actionType: 'SEND_EMAIL', success: true, details: { templateId: config.templateId, delayMinutes: config.delayMinutes, toEmail: contact.email1 } }
}

async function createTask(contactId: string, config: ActionConfig): Promise<ActionResult> {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (config.taskDueInDays || 1))

  // Set specific time if provided (e.g., "09:00" for 9am)
  if (config.taskDueTime) {
    const [hours, minutes] = config.taskDueTime.split(':').map(Number)
    dueDate.setHours(hours, minutes, 0, 0)
  }

  // Get contact info for variable replacement in title/description
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true, phone1: true, email1: true, llcName: true, propertyAddress: true }
  })

  // Replace variables in title and description
  const replaceVars = (text: string | undefined) => {
    if (!text) return text
    return text
      .replace(/\{firstName\}/gi, contact?.firstName || '')
      .replace(/\{lastName\}/gi, contact?.lastName || '')
      .replace(/\{phone\}/gi, contact?.phone1 || '')
      .replace(/\{email\}/gi, contact?.email1 || '')
      .replace(/\{llcName\}/gi, contact?.llcName || '')
      .replace(/\{companyName\}/gi, contact?.llcName || '')
      .replace(/\{propertyAddress\}/gi, contact?.propertyAddress || '')
      .replace(/\{address\}/gi, contact?.propertyAddress || '')
  }

  // Create an Activity record with type 'task' or specific task type
  const taskType = config.taskType || 'follow_up'
  await prisma.activity.create({
    data: {
      title: replaceVars(config.taskTitle) || 'Follow up',
      description: replaceVars(config.taskDescription),
      type: taskType,
      status: 'planned',
      priority: config.taskPriority || 'medium',
      due_date: dueDate,
      contact_id: contactId,
      assigned_to: config.assignToUserId || null
    }
  })
  return { actionType: 'CREATE_TASK', success: true, details: { taskType, assignedTo: config.assignToUserId, dueDate: dueDate.toISOString() } }
}

async function requeueContact(contactId: string, config: ActionConfig, context: ActionContext): Promise<ActionResult> {
  // Requeue the contact by resetting status to 'PENDING' with a delay
  const delayMinutes = (config as any).delayMinutes || 30
  const nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000)

  if (context.listId) {
    // Reset status in the specific list
    await prisma.powerDialerListContact.updateMany({
      where: { contactId, listId: context.listId },
      data: {
        status: 'PENDING',
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 }
      }
    })
  } else {
    // Reset all list entries for this contact
    await prisma.powerDialerListContact.updateMany({
      where: { contactId },
      data: {
        status: 'PENDING',
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 }
      }
    })
  }

  return { actionType: 'REQUEUE_CONTACT', success: true, details: { delayMinutes } }
}

async function removeFromQueue(contactId: string, config: ActionConfig, context: ActionContext): Promise<ActionResult> {
  const scope = config.scope || 'current'

  if (scope === 'current' && context.listId) {
    // Remove from current list only
    await prisma.powerDialerListContact.updateMany({
      where: { contactId, listId: context.listId },
      data: { status: 'REMOVED' }
    })
  } else {
    // Remove from all lists
    await prisma.powerDialerListContact.updateMany({
      where: { contactId },
      data: { status: 'REMOVED' }
    })
  }

  return { actionType: 'REMOVE_FROM_QUEUE', success: true, details: { scope } }
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

  // Also remove from all queues (mark as REMOVED since there's no bad_number status)
  await prisma.powerDialerListContact.updateMany({
    where: { contactId },
    data: { status: 'REMOVED' }
  })

  return { actionType: 'MARK_BAD_NUMBER', success: true }
}

async function deleteContact(contactId: string): Promise<ActionResult> {
  try {
    // Delete the contact - Prisma cascade will handle related records
    await prisma.contact.delete({
      where: { id: contactId }
    })
    return { actionType: 'DELETE_CONTACT' as any, success: true }
  } catch (error) {
    return {
      actionType: 'DELETE_CONTACT' as any,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete contact'
    }
  }
}


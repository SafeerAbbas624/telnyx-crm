import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SequenceStatus } from "@prisma/client"

// Rate limiting configuration (per minute)
const RATE_LIMITS = {
  SMS: parseInt(process.env.SEQUENCE_SMS_RATE_LIMIT || "30"),
  EMAIL: parseInt(process.env.SEQUENCE_EMAIL_RATE_LIMIT || "20"),
}

// Quiet hours configuration (in local time, 24-hour format)
const QUIET_HOURS = {
  enabled: process.env.SEQUENCE_QUIET_HOURS_ENABLED === "true",
  startHour: parseInt(process.env.SEQUENCE_QUIET_HOURS_START || "21"), // 9 PM
  endHour: parseInt(process.env.SEQUENCE_QUIET_HOURS_END || "8"), // 8 AM
  timezone: process.env.SEQUENCE_TIMEZONE || "America/New_York",
}

// Track rate limiting
const rateLimitCounters: { [key: string]: { count: number; resetAt: number } } = {}

function checkRateLimit(type: "SMS" | "EMAIL"): boolean {
  const now = Date.now()
  const key = type

  if (!rateLimitCounters[key] || rateLimitCounters[key].resetAt < now) {
    rateLimitCounters[key] = { count: 0, resetAt: now + 60000 }
  }

  if (rateLimitCounters[key].count >= RATE_LIMITS[type]) {
    return false
  }

  rateLimitCounters[key].count++
  return true
}

// Check if current time is within quiet hours
function isQuietHours(): boolean {
  if (!QUIET_HOURS.enabled) return false

  try {
    // Get current hour in configured timezone
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: QUIET_HOURS.timezone,
    })
    const currentHour = parseInt(formatter.format(now))

    const { startHour, endHour } = QUIET_HOURS

    // Handle overnight quiet hours (e.g., 9 PM to 8 AM)
    if (startHour > endHour) {
      return currentHour >= startHour || currentHour < endHour
    }

    // Handle same-day quiet hours (e.g., 12 PM to 2 PM)
    return currentHour >= startHour && currentHour < endHour
  } catch (error) {
    console.error("Error checking quiet hours:", error)
    return false
  }
}

// Replace template variables in message
function replaceVariables(template: string, contact: any): string {
  let result = template
  
  // Basic contact fields
  result = result.replace(/\{\{firstName\}\}/gi, contact.firstName || "")
  result = result.replace(/\{\{lastName\}\}/gi, contact.lastName || "")
  result = result.replace(/\{\{fullName\}\}/gi, contact.fullName || `${contact.firstName || ""} ${contact.lastName || ""}`.trim())
  result = result.replace(/\{\{email\}\}/gi, contact.email1 || "")
  result = result.replace(/\{\{phone\}\}/gi, contact.phone1 || "")
  
  // Property fields
  result = result.replace(/\{\{propertyAddress\}\}/gi, contact.propertyAddress || "")
  result = result.replace(/\{\{city\}\}/gi, contact.city || "")
  result = result.replace(/\{\{state\}\}/gi, contact.state || "")
  
  // Handle numbered properties if available
  if (contact.properties && Array.isArray(contact.properties)) {
    contact.properties.forEach((prop: any, idx: number) => {
      const num = idx + 1
      result = result.replace(new RegExp(`\\{\\{propertyAddress${num}\\}\\}`, "gi"), prop.address || "")
      result = result.replace(new RegExp(`\\{\\{city${num}\\}\\}`, "gi"), prop.city || "")
      result = result.replace(new RegExp(`\\{\\{state${num}\\}\\}`, "gi"), prop.state || "")
    })
  }
  
  return result
}

// GET /api/sequences/process - Get processing stats
export async function GET(request: NextRequest) {
  try {
    const now = new Date()

    // Get counts of enrollments by status
    const [activeCount, pausedCount, completedCount, pendingCount] = await Promise.all([
      prisma.sequenceEnrollment.count({ where: { status: "ACTIVE" } }),
      prisma.sequenceEnrollment.count({ where: { status: "PAUSED" } }),
      prisma.sequenceEnrollment.count({ where: { status: "COMPLETED" } }),
      prisma.sequenceEnrollment.count({
        where: {
          status: "ACTIVE",
          nextStepAt: { lte: now },
          sequence: { isActive: true },
        },
      }),
    ])

    // Get recent logs
    const recentLogs = await prisma.sequenceLog.findMany({
      orderBy: { executedAt: "desc" },
      take: 20,
      include: {
        step: {
          select: { type: true, name: true },
        },
        enrollment: {
          select: {
            contact: {
              select: { firstName: true, lastName: true },
            },
            sequence: {
              select: { name: true },
            },
          },
        },
      },
    })

    return NextResponse.json({
      stats: {
        active: activeCount,
        paused: pausedCount,
        completed: completedCount,
        pending: pendingCount,
      },
      rateLimits: RATE_LIMITS,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        result: log.result,
        stepType: log.step.type,
        stepName: log.step.name,
        contactName: `${log.enrollment.contact.firstName || ""} ${log.enrollment.contact.lastName || ""}`.trim(),
        sequenceName: log.enrollment.sequence.name,
        executedAt: log.executedAt,
        errorMessage: log.errorMessage,
      })),
    })
  } catch (error: any) {
    console.error("[Sequence Worker] Error getting stats:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/sequences/process - Process pending sequence steps
export async function POST(request: NextRequest) {
  try {
    // Verify internal call (optional security)
    const authHeader = request.headers.get("x-internal-key")
    const internalKey = process.env.INTERNAL_API_KEY

    // Allow if no internal key is set (development) or if it matches
    if (internalKey && authHeader !== internalKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check quiet hours - skip processing during quiet hours
    if (isQuietHours()) {
      return NextResponse.json({
        processed: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        message: "Skipped: Currently in quiet hours",
        quietHours: QUIET_HOURS,
      })
    }

    const now = new Date()
    
    // Find enrollments that are due for their next step
    const dueEnrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextStepAt: { lte: now },
        sequence: { isActive: true },
      },
      include: {
        sequence: {
          include: {
            steps: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        contact: {
          include: {
            properties: true,
          },
        },
      },
      take: 50, // Process in batches
    })

    console.log(`[Sequence Worker] Found ${dueEnrollments.length} enrollments to process`)

    let processed = 0
    let skipped = 0
    let failed = 0
    const results: any[] = []

    for (const enrollment of dueEnrollments) {
      try {
        const { sequence, contact } = enrollment
        const currentStep = sequence.steps[enrollment.currentStepIndex]

        if (!currentStep) {
          // No more steps - mark as completed
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: "COMPLETED" as SequenceStatus,
              completedAt: now,
            },
          })
          results.push({ enrollmentId: enrollment.id, status: "completed" })
          processed++
          continue
        }

        // Check DNC status
        if (contact.dnc) {
          await logStep(enrollment.id, currentStep.id, "SKIPPED_DNC", "Contact is on DNC list")
          await advanceEnrollment(enrollment, sequence.steps)
          skipped++
          continue
        }

        // Execute step based on type
        let success = false
        let errorMessage = ""

        switch (currentStep.type) {
          case "SMS":
            if (!checkRateLimit("SMS")) {
              results.push({ enrollmentId: enrollment.id, status: "rate_limited" })
              continue
            }
            const smsResult = await executeSmsStep(currentStep, contact, enrollment.id)
            success = smsResult.success
            errorMessage = smsResult.error || ""
            break

          case "EMAIL":
            if (!checkRateLimit("EMAIL")) {
              results.push({ enrollmentId: enrollment.id, status: "rate_limited" })
              continue
            }
            const emailResult = await executeEmailStep(currentStep, contact, enrollment.id)
            success = emailResult.success
            errorMessage = emailResult.error || ""
            break

          case "TASK":
            const taskResult = await executeTaskStep(currentStep, contact, enrollment)
            success = taskResult.success
            errorMessage = taskResult.error || ""
            break

          case "WAIT":
            const waitResult = await executeWaitStep(currentStep, contact, enrollment)
            success = waitResult.success
            errorMessage = waitResult.error || ""
            if (!success && waitResult.skipReason) {
              // Condition not met yet, don't advance but also don't fail
              // Just log and continue checking later
              skipped++
              continue
            }
            break

          default:
            errorMessage = `Unsupported step type: ${currentStep.type}`
        }

        // Log the step execution
        await logStep(
          enrollment.id,
          currentStep.id,
          success ? "SUCCESS" : "FAILED",
          errorMessage || undefined
        )

        if (success) {
          await advanceEnrollment(enrollment, sequence.steps)
          processed++
        } else {
          failed++
        }

        results.push({
          enrollmentId: enrollment.id,
          stepId: currentStep.id,
          type: currentStep.type,
          success,
          error: errorMessage || undefined,
        })
      } catch (error: any) {
        console.error(`[Sequence Worker] Error processing enrollment ${enrollment.id}:`, error)
        failed++
        results.push({
          enrollmentId: enrollment.id,
          status: "error",
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      processed,
      skipped,
      failed,
      total: dueEnrollments.length,
      results,
    })
  } catch (error: any) {
    console.error("[Sequence Worker] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Log step execution
async function logStep(
  enrollmentId: string,
  stepId: string,
  result: string,
  errorMessage?: string
) {
  await prisma.sequenceLog.create({
    data: {
      enrollmentId,
      stepId,
      result,
      errorMessage,
    },
  })
}

// Advance enrollment to next step
async function advanceEnrollment(enrollment: any, steps: any[]) {
  const nextIndex = enrollment.currentStepIndex + 1

  if (nextIndex >= steps.length) {
    // Sequence completed
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "COMPLETED" as SequenceStatus,
        completedAt: new Date(),
        currentStepIndex: nextIndex,
      },
    })
  } else {
    // Calculate next step time
    const nextStep = steps[nextIndex]
    const nextStepAt = new Date(Date.now() + nextStep.delayMinutes * 60 * 1000)

    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStepIndex: nextIndex,
        nextStepAt,
      },
    })
  }
}

// Execute SMS step
async function executeSmsStep(step: any, contact: any, enrollmentId: string) {
  try {
    const config = step.config as any
    const message = replaceVariables(config.message || "", contact)

    if (!contact.phone1) {
      return { success: false, error: "Contact has no phone number" }
    }

    // Get a sender number
    const senderNumber = await prisma.telnyxPhoneNumber.findFirst({
      where: { smsEnabled: true },
      select: { phoneNumber: true },
    })

    if (!senderNumber) {
      return { success: false, error: "No SMS-enabled phone number available" }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/telnyx/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNumber: senderNumber.phoneNumber,
        toNumber: contact.phone1,
        message,
        contactId: contact.id,
        sequenceEnrollmentId: enrollmentId,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { success: false, error: data.error || "Failed to send SMS" }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Execute Email step
async function executeEmailStep(step: any, contact: any, enrollmentId: string) {
  try {
    const config = step.config as any
    const subject = replaceVariables(config.subject || "", contact)
    const body = replaceVariables(config.body || "", contact)

    if (!contact.email1) {
      return { success: false, error: "Contact has no email address" }
    }

    // Get an email account
    const emailAccount = await prisma.emailAccount.findFirst({
      select: { id: true },
    })

    if (!emailAccount) {
      return { success: false, error: "No email account configured" }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailAccountId: emailAccount.id,
        toEmails: [contact.email1],
        subject,
        content: body,
        contactId: contact.id,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { success: false, error: data.error || "Failed to send email" }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Execute Task step
async function executeTaskStep(step: any, contact: any, enrollment: any) {
  try {
    const config = step.config as any
    const title = replaceVariables(config.title || "Sequence Task", contact)
    const description = replaceVariables(config.description || "", contact)

    // Create task as an activity
    await prisma.activity.create({
      data: {
        type: "task",
        title,
        description,
        status: "pending",
        priority: config.priority || "medium",
        contact_id: contact.id,
        user_id: enrollment.enrolledById,
        task_type: config.taskType || "follow_up",
        due_date: config.dueDays
          ? new Date(Date.now() + config.dueDays * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: 1 day
      },
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Execute Wait step - check if condition is met
async function executeWaitStep(step: any, contact: any, enrollment: any): Promise<{
  success: boolean
  error?: string
  skipReason?: string
}> {
  try {
    const config = step.config as any
    const condition = config.condition || "REPLY"
    const timeoutMinutes = config.timeoutMinutes || 0

    // Check for timeout
    if (timeoutMinutes > 0) {
      const stepStartedAt = enrollment.nextStepAt || enrollment.enrolledAt
      const timeoutAt = new Date(stepStartedAt.getTime() + timeoutMinutes * 60 * 1000)

      if (new Date() > timeoutAt) {
        // Timeout reached, skip condition and proceed
        return { success: true }
      }
    }

    // Check condition based on type
    switch (condition) {
      case "REPLY":
        // Check if contact has replied via SMS or email since enrollment
        const recentMessage = await prisma.telnyxMessage.findFirst({
          where: {
            contactId: contact.id,
            direction: "inbound",
            createdAt: { gt: enrollment.enrolledAt },
          },
          orderBy: { createdAt: "desc" },
        })

        const recentEmail = await prisma.emailMessage.findFirst({
          where: {
            contactId: contact.id,
            direction: "inbound",
            receivedAt: { gt: enrollment.enrolledAt },
          },
          orderBy: { receivedAt: "desc" },
        })

        if (recentMessage || recentEmail) {
          return { success: true }
        }
        return { success: false, skipReason: "Waiting for reply" }

      case "NO_REPLY":
        // Check that contact has NOT replied within timeout
        const anyReply = await prisma.telnyxMessage.findFirst({
          where: {
            contactId: contact.id,
            direction: "inbound",
            createdAt: { gt: enrollment.enrolledAt },
          },
        })

        const anyEmailReply = await prisma.emailMessage.findFirst({
          where: {
            contactId: contact.id,
            direction: "inbound",
            receivedAt: { gt: enrollment.enrolledAt },
          },
        })

        if (!anyReply && !anyEmailReply) {
          // No reply means condition is met
          return { success: true }
        }
        // Contact replied, pause the sequence
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "PAUSED",
            pauseReason: "Contact replied - NO_REPLY condition",
          },
        })
        return { success: false, error: "Contact replied, enrollment paused" }

      case "EMAIL_OPEN":
      case "LINK_CLICK":
        // Future: Would require email tracking implementation
        return { success: false, skipReason: `${condition} tracking not implemented yet` }

      default:
        return { success: false, error: `Unknown wait condition: ${condition}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

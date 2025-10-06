import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { automationId } = body

    if (!automationId) {
      // Process all running automations
      await processAllAutomations()
    } else {
      // Process specific automation
      await processAutomation(automationId)
    }

    return NextResponse.json({
      success: true,
      message: 'Automation processing initiated'
    })

  } catch (error) {
    console.error('Error processing automations:', error)
    return NextResponse.json(
      { error: 'Failed to process automations' },
      { status: 500 }
    )
  }
}

async function processAllAutomations() {
  const runningAutomations = await prisma.textAutomation.findMany({
    where: {
      status: 'running',
      nextRunAt: {
        lte: new Date()
      }
    }
  })

  for (const automation of runningAutomations) {
    await processAutomation(automation.id)
  }
}

async function processAutomation(automationId: string) {
  try {
    const automation = await prisma.textAutomation.findUnique({
      where: { id: automationId }
    })

    if (!automation || automation.status !== 'running') {
      return
    }

    const selectedContacts = automation.selectedContacts as string[]
    const senderNumbers = automation.senderNumbers as string[]
    
    if (!selectedContacts.length || !senderNumbers.length) {
      console.error('No contacts or sender numbers for automation:', automationId)
      return
    }

    // Send messages to all contacts in this cycle
    let sentCount = 0
    let failedCount = 0
    let deliveredCount = 0

    for (let i = automation.currentIndex; i < selectedContacts.length; i++) {
      // Re-check automation status before each message to allow immediate pause/stop
      const fresh = await prisma.textAutomation.findUnique({
        where: { id: automationId },
        select: { status: true, messageDelay: true }
      })
      if (!fresh || fresh.status !== 'running') {
        break
      }

      const contactId = selectedContacts[i]
      const senderNumber = senderNumbers[i % senderNumbers.length] // Rotate through sender numbers

      try {
        // Get contact details
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { phone1: true, firstName: true, lastName: true }
        })

        if (!contact?.phone1) {
          failedCount++
          await prisma.textAutomation.update({
            where: { id: automationId },
            data: { failedCount: { increment: 1 }, currentIndex: i + 1 }
          })
          continue
        }

        // Send message via Telnyx
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/telnyx/sms/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toNumber: contact.phone1,
            fromNumber: senderNumber,
            message: automation.message,
            contactId: contactId,
            automationId: automation.id
          })
        })

        if (response.ok) {
          sentCount++
          // Assume delivered for now - webhook will update actual status
          deliveredCount++
          await prisma.textAutomation.update({
            where: { id: automationId },
            data: {
              sentCount: { increment: 1 },
              deliveredCount: { increment: 1 },
              currentIndex: i + 1,
            }
          })
        } else {
          failedCount++
          await prisma.textAutomation.update({
            where: { id: automationId },
            data: { failedCount: { increment: 1 }, currentIndex: i + 1 }
          })
        }

        // Add delay between messages
        const delaySeconds = (fresh.messageDelay ?? automation.messageDelay) || 0
        if (i < selectedContacts.length - 1 && delaySeconds > 0) {
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
        }

      } catch (error) {
        console.error('Error sending message to contact:', contactId, error)
        failedCount++
        await prisma.textAutomation.update({
          where: { id: automationId },
          data: { failedCount: { increment: 1 }, currentIndex: i + 1 }
        })
      }
    }

    // Only complete the cycle if we actually finished all recipients AND are still running
    const latest = await prisma.textAutomation.findUnique({ where: { id: automationId } })
    if (!latest) return

    const finishedCycle = latest.status === 'running' && latest.currentIndex >= selectedContacts.length

    if (finishedCycle) {
      const nextCycle = latest.currentCycle + 1
      const willContinue = latest.isIndefinite || (latest.totalCycles !== null && nextCycle <= latest.totalCycles)

      await prisma.textAutomation.update({
        where: { id: automationId },
        data: {
          currentCycle: nextCycle,
          lastRunAt: new Date(),
          nextRunAt: willContinue ? calculateNextRunTime(latest.loopDelay, latest.loopDelayUnit) : null,
          status: willContinue ? 'running' : 'completed',
          completedAt: willContinue ? undefined : new Date(),
          // Reset index at end of cycle for the next one
          currentIndex: 0,
        }
      })
    }

    const after = await prisma.textAutomation.findUnique({ where: { id: automationId }, select: { nextRunAt: true, status: true, currentCycle: true } })
    console.log(`Automation ${automationId} cycle ${automation.currentCycle} processed:`, {
      sent: sentCount,
      delivered: deliveredCount,
      failed: failedCount,
      nextRunAt: after?.nextRunAt?.toISOString(),
      status: after?.status,
    })

  } catch (error) {
    console.error('Error processing automation:', automationId, error)
    
    // Mark automation as failed
    await prisma.textAutomation.update({
      where: { id: automationId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        nextRunAt: null,
      }
    }).catch(console.error)
  }
}

function calculateNextRunTime(delay: number, unit: string): Date {
  const now = new Date()
  
  switch (unit) {
    case 'hours':
      return new Date(now.getTime() + delay * 60 * 60 * 1000)
    case 'days':
      return new Date(now.getTime() + delay * 24 * 60 * 60 * 1000)
    case 'weeks':
      return new Date(now.getTime() + delay * 7 * 24 * 60 * 60 * 1000)
    case 'months':
      const nextMonth = new Date(now)
      nextMonth.setMonth(nextMonth.getMonth() + delay)
      return nextMonth
    default:
      return new Date(now.getTime() + delay * 7 * 24 * 60 * 60 * 1000) // Default to weeks
  }
}

// GET endpoint to manually trigger processing (for testing)
export async function GET() {
  try {
    await processAllAutomations()
    return NextResponse.json({
      success: true,
      message: 'All automations processed'
    })
  } catch (error) {
    console.error('Error in GET processing:', error)
    return NextResponse.json(
      { error: 'Failed to process automations' },
      { status: 500 }
    )
  }
}

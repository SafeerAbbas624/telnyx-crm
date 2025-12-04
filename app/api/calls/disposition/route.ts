import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { callId, callType, outcome, notes, tags, scheduleCallback } = await req.json()

    if (!callId || !callType || !outcome) {
      return NextResponse.json(
        { error: 'Missing required fields: callId, callType, outcome' },
        { status: 400 }
      )
    }

    const validOutcomes = ['interested', 'not_interested', 'callback', 'voicemail', 'wrong_number', 'no_answer', 'busy']
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` },
        { status: 400 }
      )
    }

    let updatedCall: any = null

    // Update based on call type
    if (callType === 'telnyx') {
      updatedCall = await prisma.telnyxCall.update({
        where: { id: callId },
        data: {
          callOutcome: outcome,
          callNotes: notes || null,
          dispositionSetAt: new Date(),
          dispositionSetBy: session.user.id,
          automationTriggered: false, // Will be set to true after automation runs
        },
      })
    } else if (callType === 'vapi') {
      updatedCall = await prisma.vapiCall.update({
        where: { id: callId },
        data: {
          callOutcome: outcome,
          callNotes: notes || null,
          dispositionSetAt: new Date(),
          dispositionSetBy: session.user.id,
          automationTriggered: false,
        },
      })
    } else if (callType === 'power_dialer') {
      updatedCall = await prisma.powerDialerCall.update({
        where: { id: callId },
        data: {
          callOutcome: outcome,
          callNotes: notes || null,
          dispositionSetAt: new Date(),
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid callType. Must be: telnyx, vapi, or power_dialer' },
        { status: 400 }
      )
    }

    // Get contact ID for automation
    let contactId: string | null = null
    if (callType === 'telnyx') {
      const call = await prisma.telnyxCall.findUnique({
        where: { id: callId },
        select: { contactId: true },
      })
      contactId = call?.contactId || null
    } else if (callType === 'vapi') {
      // For VAPI, we need to get contact from customer_id or other means
      // This might need to be enhanced based on your VAPI integration
      contactId = null
    } else if (callType === 'power_dialer') {
      const call = await prisma.powerDialerCall.findUnique({
        where: { id: callId },
        select: { contactId: true },
      })
      contactId = call?.contactId || null
    }

    // Add tags if provided
    if (tags && tags.length > 0 && contactId) {
      for (const tagName of tags) {
        const tag = await prisma.tag.findUnique({
          where: { name: tagName },
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
              created_by: session.user.id,
            },
          })
        }
      }
    }

    // Schedule callback if requested
    if (scheduleCallback && contactId) {
      const { date, time } = scheduleCallback
      const callbackDateTime = new Date(`${date}T${time}`)

      await prisma.activity.create({
        data: {
          contact_id: contactId,
          type: 'call',
          title: `Callback scheduled from call disposition`,
          description: `Callback scheduled for ${callbackDateTime.toLocaleString()}`,
          status: 'planned',
          due_date: callbackDateTime,
          created_by: session.user.id,
        },
      })
    }

    return NextResponse.json({
      success: true,
      call: updatedCall,
      message: `Call disposition set to ${outcome}`,
    })
  } catch (error) {
    console.error('Error setting call disposition:', error)
    return NextResponse.json(
      { error: 'Failed to set call disposition' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const callId = searchParams.get('callId')
    const callType = searchParams.get('callType')

    if (!callId || !callType) {
      return NextResponse.json(
        { error: 'Missing required query params: callId, callType' },
        { status: 400 }
      )
    }

    let call: any = null

    if (callType === 'telnyx') {
      call = await prisma.telnyxCall.findUnique({
        where: { id: callId },
        select: {
          id: true,
          callOutcome: true,
          callNotes: true,
          dispositionSetAt: true,
          dispositionSetBy: true,
        },
      })
    } else if (callType === 'vapi') {
      call = await prisma.vapiCall.findUnique({
        where: { id: callId },
        select: {
          id: true,
          callOutcome: true,
          callNotes: true,
          dispositionSetAt: true,
          dispositionSetBy: true,
        },
      })
    } else if (callType === 'power_dialer') {
      call = await prisma.powerDialerCall.findUnique({
        where: { id: callId },
        select: {
          id: true,
          callOutcome: true,
          callNotes: true,
          dispositionSetAt: true,
        },
      })
    }

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json(call)
  } catch (error) {
    console.error('Error fetching call disposition:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call disposition' },
      { status: 500 }
    )
  }
}


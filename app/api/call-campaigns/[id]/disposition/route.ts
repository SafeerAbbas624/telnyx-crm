import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Set disposition for a contact in a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contactId, disposition, notes, callDuration } = body

    if (!contactId || !disposition) {
      return NextResponse.json(
        { error: 'contactId and disposition are required' },
        { status: 400 }
      )
    }

    // Find the campaign contact
    const campaignContact = await prisma.callCampaignContact.findFirst({
      where: {
        campaignId: params.id,
        contactId,
      }
    })

    if (!campaignContact) {
      return NextResponse.json(
        { error: 'Contact not found in campaign' },
        { status: 404 }
      )
    }

    // Determine new status based on disposition
    let newStatus: 'completed' | 'callback' | 'skipped' = 'completed'
    if (disposition === 'Callback') {
      newStatus = 'callback'
    } else if (disposition === 'Skip') {
      newStatus = 'skipped'
    }

    // If "Do Not Call" disposition, mark the contact as DNC
    if (disposition === 'Do Not Call') {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          dnc: true,
          dncReason: notes || 'Marked as DNC during call campaign',
        }
      })
    }

    // If "Wrong Number" disposition, create activity to record the issue
    if (disposition === 'Wrong Number') {
      await prisma.activity.create({
        data: {
          contact_id: contactId,
          type: 'note',
          title: 'Wrong Number',
          description: `Phone number marked as wrong number during call campaign. ${notes || ''}`.trim(),
        }
      })
    }

    // Update the campaign contact
    const updatedContact = await prisma.callCampaignContact.update({
      where: { id: campaignContact.id },
      data: {
        disposition,
        notes,
        callDuration,
        status: newStatus,
        completedAt: new Date(),
        lastCalledAt: new Date(),
        attemptCount: { increment: 1 },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone1: true,
          }
        }
      }
    })

    // Update campaign statistics
    const stats = await prisma.callCampaignContact.groupBy({
      by: ['status'],
      where: { campaignId: params.id },
      _count: true,
    })

    const contactsCalled = stats.reduce((sum, s) => 
      s.status !== 'pending' && s.status !== 'calling' ? sum + s._count : sum, 0)
    const contactsAnswered = stats.find(s => s.status === 'completed')?._count || 0

    await prisma.callCampaign.update({
      where: { id: params.id },
      data: {
        contactsCalled,
        contactsAnswered,
        ...(callDuration && { totalTalkTime: { increment: callDuration } }),
      }
    })

    return NextResponse.json({ 
      success: true, 
      contact: updatedContact,
      stats: { contactsCalled, contactsAnswered }
    })
  } catch (error) {
    console.error('Error setting disposition:', error)
    return NextResponse.json(
      { error: 'Failed to set disposition' },
      { status: 500 }
    )
  }
}


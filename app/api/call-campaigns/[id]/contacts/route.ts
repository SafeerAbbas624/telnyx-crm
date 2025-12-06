import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Add contacts to a campaign
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
    const { contactIds, tagId } = body

    // Check if campaign exists
    const campaign = await prisma.callCampaign.findUnique({
      where: { id: params.id }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot add contacts to a running campaign' },
        { status: 400 }
      )
    }

    let idsToAdd: string[] = []

    // If tagId provided, get all contacts with that tag
    if (tagId) {
      const contactTags = await prisma.contactTag.findMany({
        where: { tag_id: tagId },
        select: { contact_id: true }
      })
      idsToAdd = contactTags.map(ct => ct.contact_id)
    } else if (contactIds && contactIds.length > 0) {
      idsToAdd = contactIds
    } else {
      return NextResponse.json(
        { error: 'Either contactIds or tagId is required' },
        { status: 400 }
      )
    }

    // Filter out DNC contacts and contacts without phone numbers
    const validContacts = await prisma.contact.findMany({
      where: {
        id: { in: idsToAdd },
        dnc: { not: true }, // Exclude DNC contacts
        OR: [
          { phone1: { not: null } },
          { phone2: { not: null } },
          { phone3: { not: null } },
        ],
        deletedAt: null, // Exclude soft-deleted contacts
      },
      select: { id: true }
    })
    const validIds = validContacts.map(c => c.id)
    const dncOrNoPhoneCount = idsToAdd.length - validIds.length

    // Filter out contacts already in campaign
    const existingContacts = await prisma.callCampaignContact.findMany({
      where: {
        campaignId: params.id,
        contactId: { in: validIds }
      },
      select: { contactId: true }
    })
    const existingIds = new Set(existingContacts.map(c => c.contactId))
    const newIds = validIds.filter(id => !existingIds.has(id))

    if (newIds.length === 0) {
      const alreadyInCampaign = validIds.length - newIds.length
      return NextResponse.json({
        added: 0,
        skippedDncOrNoPhone: dncOrNoPhoneCount,
        skippedAlreadyInCampaign: alreadyInCampaign,
        message: dncOrNoPhoneCount > 0
          ? `${dncOrNoPhoneCount} contacts skipped (DNC or no phone). All remaining contacts are already in the campaign.`
          : 'All contacts are already in the campaign'
      })
    }

    // Add contacts to campaign
    await prisma.callCampaignContact.createMany({
      data: newIds.map(contactId => ({
        campaignId: params.id,
        contactId,
      })),
      skipDuplicates: true,
    })

    // Update campaign total contacts count
    const totalContacts = await prisma.callCampaignContact.count({
      where: { campaignId: params.id }
    })

    await prisma.callCampaign.update({
      where: { id: params.id },
      data: { totalContacts }
    })

    const alreadyInCampaign = validIds.length - newIds.length
    return NextResponse.json({
      added: newIds.length,
      skippedDncOrNoPhone: dncOrNoPhoneCount,
      skippedAlreadyInCampaign: alreadyInCampaign,
      totalContacts,
      message: dncOrNoPhoneCount > 0
        ? `Added ${newIds.length} contacts. ${dncOrNoPhoneCount} skipped (DNC or no phone).`
        : undefined
    })
  } catch (error) {
    console.error('Error adding contacts to campaign:', error)
    return NextResponse.json(
      { error: 'Failed to add contacts to campaign' },
      { status: 500 }
    )
  }
}

// DELETE - Remove contacts from a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contactIds } = body

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactIds is required' },
        { status: 400 }
      )
    }

    const campaign = await prisma.callCampaign.findUnique({
      where: { id: params.id }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot remove contacts from a running campaign' },
        { status: 400 }
      )
    }

    // Remove contacts
    const result = await prisma.callCampaignContact.deleteMany({
      where: {
        campaignId: params.id,
        contactId: { in: contactIds }
      }
    })

    // Update campaign total contacts count
    const totalContacts = await prisma.callCampaignContact.count({
      where: { campaignId: params.id }
    })

    await prisma.callCampaign.update({
      where: { id: params.id },
      data: { totalContacts }
    })

    return NextResponse.json({
      removed: result.count,
      totalContacts
    })
  } catch (error) {
    console.error('Error removing contacts from campaign:', error)
    return NextResponse.json(
      { error: 'Failed to remove contacts from campaign' },
      { status: 500 }
    )
  }
}


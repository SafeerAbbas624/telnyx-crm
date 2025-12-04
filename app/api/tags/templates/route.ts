import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Predefined tag templates for common real estate scenarios
const TAG_TEMPLATES = {
  'lead-qualification': {
    name: 'Lead Qualification',
    description: 'Tags for qualifying leads based on interest and readiness',
    tags: [
      { name: 'Hot Lead', color: '#EF4444', description: 'High interest, ready to move forward' },
      { name: 'Warm Lead', color: '#F97316', description: 'Interested but needs nurturing' },
      { name: 'Cold Lead', color: '#6B7280', description: 'Low interest or unresponsive' },
      { name: 'Qualified', color: '#10B981', description: 'Meets criteria and ready to proceed' },
      { name: 'Unqualified', color: '#DC2626', description: 'Does not meet criteria' }
    ]
  },
  'property-types': {
    name: 'Property Types',
    description: 'Common property types for real estate',
    tags: [
      { name: 'Single Family', color: '#3B82F6', description: 'Single family residential' },
      { name: 'Multi Family', color: '#8B5CF6', description: 'Multi-unit residential' },
      { name: 'Condo', color: '#06B6D4', description: 'Condominium' },
      { name: 'Townhouse', color: '#84CC16', description: 'Townhouse or row house' },
      { name: 'Commercial', color: '#F59E0B', description: 'Commercial property' },
      { name: 'Land', color: '#10B981', description: 'Vacant land or lots' }
    ]
  },
  'deal-stages': {
    name: 'Deal Stages',
    description: 'Track where deals are in the pipeline',
    tags: [
      { name: 'Initial Contact', color: '#6B7280', description: 'First contact made' },
      { name: 'Needs Assessment', color: '#3B82F6', description: 'Understanding requirements' },
      { name: 'Property Shown', color: '#8B5CF6', description: 'Property has been shown' },
      { name: 'Offer Made', color: '#F59E0B', description: 'Offer has been submitted' },
      { name: 'Under Contract', color: '#10B981', description: 'Contract signed' },
      { name: 'Closing Scheduled', color: '#059669', description: 'Closing date set' }
    ]
  },
  'communication-preferences': {
    name: 'Communication Preferences',
    description: 'How contacts prefer to be reached',
    tags: [
      { name: 'Prefers Phone', color: '#3B82F6', description: 'Prefers phone calls' },
      { name: 'Prefers Email', color: '#8B5CF6', description: 'Prefers email communication' },
      { name: 'Prefers Text', color: '#10B981', description: 'Prefers text messages' },
      { name: 'Morning Person', color: '#F59E0B', description: 'Best to contact in morning' },
      { name: 'Evening Person', color: '#EF4444', description: 'Best to contact in evening' }
    ]
  },
  'lead-sources': {
    name: 'Lead Sources',
    description: 'Where leads are coming from',
    tags: [
      { name: 'Website', color: '#3B82F6', description: 'From company website' },
      { name: 'Referral', color: '#10B981', description: 'Referred by existing client' },
      { name: 'Social Media', color: '#8B5CF6', description: 'From social media platforms' },
      { name: 'Cold Call', color: '#6B7280', description: 'From cold calling' },
      { name: 'Direct Mail', color: '#F59E0B', description: 'From direct mail campaign' },
      { name: 'Event', color: '#EF4444', description: 'From events or trade shows' }
    ]
  },
  'urgency-levels': {
    name: 'Urgency Levels',
    description: 'How urgent the contact\'s needs are',
    tags: [
      { name: 'Urgent', color: '#DC2626', description: 'Needs immediate attention' },
      { name: 'High Priority', color: '#EF4444', description: 'High priority contact' },
      { name: 'Medium Priority', color: '#F59E0B', description: 'Medium priority contact' },
      { name: 'Low Priority', color: '#6B7280', description: 'Low priority contact' },
      { name: 'Follow Up Later', color: '#8B5CF6', description: 'Follow up in future' }
    ]
  }
}

// GET /api/tags/templates - Get all tag templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      templates: Object.entries(TAG_TEMPLATES).map(([key, template]) => ({
        id: key,
        ...template
      }))
    })

  } catch (error) {
    console.error('Error fetching tag templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tag templates' },
      { status: 500 }
    )
  }
}

// POST /api/tags/templates - Apply a tag template (create tags from template)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { templateId, contactIds = [] } = body

    if (!templateId || !TAG_TEMPLATES[templateId as keyof typeof TAG_TEMPLATES]) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      )
    }

    const template = TAG_TEMPLATES[templateId as keyof typeof TAG_TEMPLATES]
    const createdTags = []

    // Create tags from template
    for (const tagData of template.tags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagData.name },
        update: {
          color: tagData.color,
          description: tagData.description
        },
        create: {
          name: tagData.name,
          color: tagData.color,
          description: tagData.description
        }
      })
      createdTags.push(tag)
    }

    // If contactIds provided, apply tags to those contacts
    if (contactIds.length > 0) {
      // For team members, verify they have access to all contacts
      if (session.user.role === 'TEAM_USER') {
        const assignedContacts = await prisma.contactAssignment.findMany({
          where: {
            userId: session.user.id,
            contactId: { in: contactIds }
          },
          select: { contactId: true }
        })

        const assignedContactIds = assignedContacts.map(ac => ac.contactId)
        const unauthorizedContacts = contactIds.filter((id: string) => !assignedContactIds.includes(id))

        if (unauthorizedContacts.length > 0) {
          return NextResponse.json(
            { error: 'Forbidden - Some contacts not assigned to you' },
            { status: 403 }
          )
        }
      }

      // Apply tags to contacts
      const associations = []
      for (const contactId of contactIds) {
        for (const tag of createdTags) {
          associations.push({
            contact_id: contactId,
            tag_id: tag.id,
            created_by: session.user.id
          })
        }
      }

      await prisma.contactTag.createMany({
        data: associations,
        skipDuplicates: true
      })
    }

    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        ...template
      },
      createdTags: createdTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description
      })),
      appliedToContacts: contactIds.length
    })

  } catch (error) {
    console.error('Error applying tag template:', error)
    return NextResponse.json(
      { error: 'Failed to apply tag template' },
      { status: 500 }
    )
  }
}

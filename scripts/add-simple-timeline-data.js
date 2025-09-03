const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function addSimpleTimelineData() {
  try {
    console.log('🌱 Adding simple timeline data for testing...')

    // Get first contact
    const contact = await prisma.contact.findFirst({
      select: { id: true, firstName: true, lastName: true }
    })

    if (!contact) {
      console.log('❌ No contacts found. Please add contacts first.')
      return
    }

    console.log(`📝 Adding timeline data for ${contact.firstName} ${contact.lastName}`)

    // Add some activities with different dates
    const activities = [
      {
        contact_id: contact.id,
        type: 'call',
        title: 'Initial Contact Call',
        description: 'First contact with potential client about property investment opportunities. Discussed their budget and timeline.',
        status: 'completed',
        due_date: new Date('2024-12-01T10:00:00Z'),
        created_at: new Date('2024-12-01T10:00:00Z'),
        updated_at: new Date('2024-12-01T10:00:00Z')
      },
      {
        contact_id: contact.id,
        type: 'meeting',
        title: 'Property Viewing Scheduled',
        description: 'Arranged property viewing for Tuesday at 2 PM. Client is very interested in the downtown location.',
        status: 'completed',
        due_date: new Date('2024-12-05T14:00:00Z'),
        created_at: new Date('2024-12-05T14:00:00Z'),
        updated_at: new Date('2024-12-05T14:00:00Z')
      },
      {
        contact_id: contact.id,
        type: 'email',
        title: 'Follow-up Email Sent',
        description: 'Sent detailed property information, pricing, and financing options. Included market analysis report.',
        status: 'completed',
        due_date: new Date('2024-12-08T09:30:00Z'),
        created_at: new Date('2024-12-08T09:30:00Z'),
        updated_at: new Date('2024-12-08T09:30:00Z')
      },
      {
        contact_id: contact.id,
        type: 'call',
        title: 'Contract Discussion',
        description: 'Discussed contract terms, conditions, and closing timeline. Client has some questions about financing.',
        status: 'completed',
        due_date: new Date('2024-12-12T11:00:00Z'),
        created_at: new Date('2024-12-12T11:00:00Z'),
        updated_at: new Date('2024-12-12T11:00:00Z')
      },
      {
        contact_id: contact.id,
        type: 'meeting',
        title: 'Document Review Meeting',
        description: 'Reviewed all necessary documents with client. Everything looks good for closing.',
        status: 'completed',
        due_date: new Date('2024-12-15T15:00:00Z'),
        created_at: new Date('2024-12-15T15:00:00Z'),
        updated_at: new Date('2024-12-15T15:00:00Z')
      },
      {
        contact_id: contact.id,
        type: 'follow_up',
        title: 'Final Follow-up Call',
        description: 'Confirmed all details for closing. Client is excited and ready to proceed.',
        status: 'completed',
        due_date: new Date('2024-12-18T10:00:00Z'),
        created_at: new Date('2024-12-18T10:00:00Z'),
        updated_at: new Date('2024-12-18T10:00:00Z')
      },
      {
        contact_id: contact.id,
        type: 'appointment',
        title: 'Closing Appointment',
        description: 'Final closing meeting scheduled. All paperwork ready and financing approved.',
        status: 'planned',
        due_date: new Date('2024-12-22T13:00:00Z'),
        created_at: new Date('2024-12-20T09:00:00Z'),
        updated_at: new Date('2024-12-20T09:00:00Z')
      }
    ]

    // Add activities
    for (const activity of activities) {
      await prisma.activity.create({
        data: activity
      })
      console.log(`✅ Added activity: ${activity.title}`)
    }

    console.log('🎉 Simple timeline data added successfully!')
    console.log('📊 You can now test the timeline page with realistic activity data')

  } catch (error) {
    console.error('❌ Error adding timeline data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the function
addSimpleTimelineData()

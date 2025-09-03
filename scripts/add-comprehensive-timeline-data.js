const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function addComprehensiveTimelineData() {
  try {
    console.log('🌱 Adding comprehensive timeline data for testing...')

    // Get first contact
    const contact = await prisma.contact.findFirst({
      select: { id: true, firstName: true, lastName: true, phone1: true, email1: true }
    })

    if (!contact) {
      console.log('❌ No contacts found. Please add contacts first.')
      return
    }

    console.log(`📝 Adding timeline data for ${contact.firstName} ${contact.lastName}`)

    // Add TelnyxMessages (SMS)
    const messages = [
      {
        contactId: contact.id,
        fromNumber: contact.phone1 || '+1234567890',
        toNumber: '+1987654321',
        direction: 'inbound',
        content: 'Hi! I saw your property listing and I\'m interested. Can we schedule a viewing?',
        status: 'delivered',
        createdAt: new Date('2024-12-01T09:00:00Z'),
        updatedAt: new Date('2024-12-01T09:00:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: '+1987654321',
        toNumber: contact.phone1 || '+1234567890',
        direction: 'outbound',
        content: 'Absolutely! I have availability this Tuesday at 2 PM or Wednesday at 10 AM. Which works better for you?',
        status: 'delivered',
        createdAt: new Date('2024-12-01T09:15:00Z'),
        updatedAt: new Date('2024-12-01T09:15:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: contact.phone1 || '+1234567890',
        toNumber: '+1987654321',
        direction: 'inbound',
        content: 'Tuesday at 2 PM works perfect! What\'s the address?',
        status: 'delivered',
        createdAt: new Date('2024-12-01T09:30:00Z'),
        updatedAt: new Date('2024-12-01T09:30:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: '+1987654321',
        toNumber: contact.phone1 || '+1234567890',
        direction: 'outbound',
        content: 'Great! The address is 123 Main Street. I\'ll send you more details via email.',
        status: 'delivered',
        createdAt: new Date('2024-12-01T09:45:00Z'),
        updatedAt: new Date('2024-12-01T09:45:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: contact.phone1 || '+1234567890',
        toNumber: '+1987654321',
        direction: 'inbound',
        content: 'Perfect! Looking forward to it. Thank you!',
        status: 'delivered',
        createdAt: new Date('2024-12-01T10:00:00Z'),
        updatedAt: new Date('2024-12-01T10:00:00Z')
      }
    ]

    for (const message of messages) {
      await prisma.telnyxMessage.create({ data: message })
      console.log(`✅ Added message: ${message.content.substring(0, 50)}...`)
    }

    // Add TelnyxCalls
    const calls = [
      {
        contactId: contact.id,
        fromNumber: '+1987654321',
        toNumber: contact.phone1 || '+1234567890',
        direction: 'outbound',
        status: 'hangup',
        duration: 180, // 3 minutes
        answeredAt: new Date('2024-12-02T14:00:00Z'),
        endedAt: new Date('2024-12-02T14:03:00Z'),
        createdAt: new Date('2024-12-02T14:00:00Z'),
        updatedAt: new Date('2024-12-02T14:03:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: contact.phone1 || '+1234567890',
        toNumber: '+1987654321',
        direction: 'inbound',
        status: 'hangup',
        duration: 420, // 7 minutes
        answeredAt: new Date('2024-12-05T16:30:00Z'),
        endedAt: new Date('2024-12-05T16:37:00Z'),
        createdAt: new Date('2024-12-05T16:30:00Z'),
        updatedAt: new Date('2024-12-05T16:37:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: '+1987654321',
        toNumber: contact.phone1 || '+1234567890',
        direction: 'outbound',
        status: 'failed',
        duration: 0,
        hangupCause: 'no_answer',
        createdAt: new Date('2024-12-10T11:15:00Z'),
        updatedAt: new Date('2024-12-10T11:15:00Z')
      },
      {
        contactId: contact.id,
        fromNumber: contact.phone1 || '+1234567890',
        toNumber: '+1987654321',
        direction: 'inbound',
        status: 'hangup',
        duration: 600, // 10 minutes
        answeredAt: new Date('2024-12-12T09:00:00Z'),
        endedAt: new Date('2024-12-12T09:10:00Z'),
        createdAt: new Date('2024-12-12T09:00:00Z'),
        updatedAt: new Date('2024-12-12T09:10:00Z')
      }
    ]

    for (const call of calls) {
      await prisma.telnyxCall.create({ data: call })
      console.log(`✅ Added call: ${call.direction} ${call.status} (${call.duration}s)`)
    }

    // Add Emails
    const emails = [
      {
        contact_id: contact.id,
        direction: 'outbound',
        subject: 'Property Viewing Details - 123 Main Street',
        body: 'Hi there! As promised, here are the details for your property viewing on Tuesday at 2 PM. The property is located at 123 Main Street and features 3 bedrooms, 2 bathrooms, and a beautiful garden. Please let me know if you have any questions!',
        status: 'delivered',
        from_email: 'agent@realestate.com',
        to_email: contact.email1 || 'client@example.com',
        timestamp: new Date('2024-12-01T11:00:00Z')
      },
      {
        contact_id: contact.id,
        direction: 'inbound',
        subject: 'Re: Property Viewing Details - 123 Main Street',
        body: 'Thank you for the details! The property sounds perfect. I\'m very excited about the viewing. Just to confirm - Tuesday December 3rd at 2 PM, correct?',
        status: 'delivered',
        from_email: contact.email1 || 'client@example.com',
        to_email: 'agent@realestate.com',
        timestamp: new Date('2024-12-01T15:30:00Z')
      },
      {
        contact_id: contact.id,
        direction: 'outbound',
        subject: 'Market Analysis Report - 123 Main Street Area',
        body: 'I\'ve prepared a comprehensive market analysis for the area around 123 Main Street. The report shows strong appreciation trends and excellent investment potential. Please find the detailed report attached.',
        status: 'read',
        from_email: 'agent@realestate.com',
        to_email: contact.email1 || 'client@example.com',
        timestamp: new Date('2024-12-03T10:00:00Z'),
        opened_at: new Date('2024-12-03T14:30:00Z')
      },
      {
        contact_id: contact.id,
        direction: 'outbound',
        subject: 'Follow-up: Contract and Next Steps',
        body: 'It was great meeting you at the property viewing! Based on our discussion, I\'ve prepared the initial contract documents. Please review them and let me know if you have any questions or would like to schedule a meeting to go through the details.',
        status: 'delivered',
        from_email: 'agent@realestate.com',
        to_email: contact.email1 || 'client@example.com',
        timestamp: new Date('2024-12-04T09:00:00Z')
      }
    ]

    for (const email of emails) {
      await prisma.email.create({ data: email })
      console.log(`✅ Added email: ${email.subject}`)
    }

    console.log('🎉 Comprehensive timeline data added successfully!')
    console.log('📊 Added:')
    console.log(`   - ${messages.length} SMS messages`)
    console.log(`   - ${calls.length} phone calls`)
    console.log(`   - ${emails.length} emails`)
    console.log(`   - Plus existing activities`)
    console.log('🎯 You can now test the timeline page with all communication types!')

  } catch (error) {
    console.error('❌ Error adding timeline data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the function
addComprehensiveTimelineData()

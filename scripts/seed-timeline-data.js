const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedTimelineData() {
  try {
    console.log('🌱 Starting to seed timeline data...')

    // Get existing contacts
    const contacts = await prisma.contact.findMany({
      take: 5, // Use first 5 contacts for demo
      select: { id: true, firstName: true, lastName: true, phone1: true, email1: true }
    })

    if (contacts.length === 0) {
      console.log('❌ No contacts found. Please add contacts first.')
      return
    }

    console.log(`📞 Found ${contacts.length} contacts to add timeline data for`)

    // Sample data arrays
    const activityTypes = ['call', 'meeting', 'email', 'note', 'follow_up', 'appointment']
    const callStatuses = ['answered', 'missed', 'busy', 'no_answer']
    const messageStatuses = ['sent', 'delivered', 'read', 'failed']
    const emailStatuses = ['sent', 'delivered', 'opened', 'clicked', 'bounced']
    const directions = ['inbound', 'outbound']

    const sampleActivities = [
      { title: 'Initial Contact Call', description: 'First contact with potential client about property investment' },
      { title: 'Property Viewing Scheduled', description: 'Arranged property viewing for next Tuesday at 2 PM' },
      { title: 'Follow-up Email Sent', description: 'Sent detailed property information and pricing' },
      { title: 'Contract Discussion', description: 'Discussed contract terms and conditions' },
      { title: 'Closing Meeting', description: 'Final meeting to close the deal' },
      { title: 'Document Review', description: 'Reviewed all necessary documents with client' },
      { title: 'Payment Processing', description: 'Processed initial payment and paperwork' }
    ]

    const sampleMessages = [
      'Hi! I saw your property listing and I\'m interested. Can we schedule a viewing?',
      'Thank you for the information. When would be a good time to discuss further?',
      'I have a few questions about the financing options available.',
      'The property looks great! What\'s the next step in the process?',
      'Can you send me more details about the neighborhood and amenities?',
      'I\'m ready to move forward. What documents do you need from me?',
      'Thanks for your time today. Looking forward to hearing from you soon.'
    ]

    const sampleEmails = [
      { subject: 'Property Investment Opportunity', content: 'I wanted to reach out about an exciting property investment opportunity...' },
      { subject: 'Follow-up on Property Viewing', content: 'Thank you for taking the time to view the property yesterday...' },
      { subject: 'Contract and Documentation', content: 'Please find attached the contract and all necessary documentation...' },
      { subject: 'Market Analysis Report', content: 'I\'ve prepared a comprehensive market analysis for your review...' },
      { subject: 'Closing Date Confirmation', content: 'This email confirms our closing date and final details...' }
    ]

    // Generate timeline data for each contact
    for (const contact of contacts) {
      console.log(`📝 Adding timeline data for ${contact.firstName} ${contact.lastName}`)

      // Generate random dates over the past 3 months
      const now = new Date()
      const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000))

      // Add Activities (3-5 per contact)
      const numActivities = Math.floor(Math.random() * 3) + 3
      for (let i = 0; i < numActivities; i++) {
        const randomDate = new Date(threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime()))
        const activity = sampleActivities[Math.floor(Math.random() * sampleActivities.length)]
        const status = Math.random() > 0.3 ? 'completed' : (Math.random() > 0.5 ? 'planned' : 'cancelled')

        await prisma.activity.create({
          data: {
            contact_id: contact.id,
            type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
            title: activity.title,
            description: activity.description,
            status: status,
            due_date: randomDate,
            created_at: randomDate,
            updated_at: randomDate
          }
        })
      }

      // Add Calls (2-4 per contact)
      const numCalls = Math.floor(Math.random() * 3) + 2
      for (let i = 0; i < numCalls; i++) {
        const randomDate = new Date(threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime()))
        const direction = directions[Math.floor(Math.random() * directions.length)]
        const status = callStatuses[Math.floor(Math.random() * callStatuses.length)]
        const duration = status === 'answered' ? Math.floor(Math.random() * 600) + 30 : 0 // 30s to 10min if answered

        try {
          await prisma.call.create({
            data: {
              contact_id: contact.id,
              from_number: direction === 'outbound' ? '+1234567890' : contact.phone1 || '+1234567890',
              to_number: direction === 'inbound' ? '+1234567890' : contact.phone1 || '+1234567890',
              direction: direction,
              status: status,
              duration: duration,
              timestamp: randomDate
            }
          })
        } catch (error) {
          console.log(`⚠️  Call table might not exist yet: ${error.message}`)
        }
      }

      // Add Messages (3-6 per contact)
      const numMessages = Math.floor(Math.random() * 4) + 3
      for (let i = 0; i < numMessages; i++) {
        const randomDate = new Date(threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime()))
        const direction = directions[Math.floor(Math.random() * directions.length)]
        const status = messageStatuses[Math.floor(Math.random() * messageStatuses.length)]
        const content = sampleMessages[Math.floor(Math.random() * sampleMessages.length)]

        try {
          await prisma.message.create({
            data: {
              contact_id: contact.id,
              phone_number: contact.phone1 || '+1234567890',
              direction: direction,
              content: content,
              status: status,
              timestamp: randomDate
            }
          })
        } catch (error) {
          console.log(`⚠️  Message table might not exist yet: ${error.message}`)
        }
      }

      // Add Emails (2-4 per contact)
      const numEmails = Math.floor(Math.random() * 3) + 2
      for (let i = 0; i < numEmails; i++) {
        const randomDate = new Date(threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime()))
        const direction = directions[Math.floor(Math.random() * directions.length)]
        const status = emailStatuses[Math.floor(Math.random() * emailStatuses.length)]
        const email = sampleEmails[Math.floor(Math.random() * sampleEmails.length)]

        try {
          await prisma.email.create({
            data: {
              contact_id: contact.id,
              email_address: contact.email1 || 'example@email.com',
              direction: direction,
              subject: email.subject,
              body: email.content,
              status: status,
              timestamp: randomDate
            }
          })
        } catch (error) {
          console.log(`⚠️  Email table might not exist yet: ${error.message}`)
        }
      }
    }

    console.log('✅ Timeline data seeding completed successfully!')
    console.log('📊 Added sample activities, calls, messages, and emails for testing')
    console.log('🎯 You can now test the timeline page with realistic data')

  } catch (error) {
    console.error('❌ Error seeding timeline data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeding function
seedTimelineData()

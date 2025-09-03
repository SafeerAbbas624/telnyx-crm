const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createConversationsFromMessages() {
  try {
    console.log('🔄 Creating conversation records from existing messages...')

    // Get all contacts that have messages
    const contactsWithMessages = await prisma.contact.findMany({
      where: {
        OR: [
          {
            telnyx_messages: {
              some: {}
            }
          }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        phone2: true,
        phone3: true,
        telnyx_messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            direction: true,
          }
        }
      }
    })

    console.log(`📱 Found ${contactsWithMessages.length} contacts with messages`)

    for (const contact of contactsWithMessages) {
      const phoneNumber = contact.phone1 || contact.phone2 || contact.phone3
      
      if (!phoneNumber) {
        console.log(`⚠️  Skipping ${contact.firstName} ${contact.lastName} - no phone number`)
        continue
      }

      // Check if conversation already exists
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          contact_id: contact.id,
          phone_number: phoneNumber
        }
      })

      if (existingConversation) {
        console.log(`✅ Conversation already exists for ${contact.firstName} ${contact.lastName}`)
        continue
      }

      // Get message stats for this contact
      const messageStats = await prisma.telnyxMessage.aggregate({
        where: {
          contactId: contact.id
        },
        _count: {
          id: true
        }
      })

      // Get latest message timestamp
      const latestMessage = await prisma.telnyxMessage.findFirst({
        where: {
          contactId: contact.id
        },
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          direction: true
        }
      })

      // Count unread messages (assuming inbound messages from last 24 hours are unread)
      const unreadCount = await prisma.telnyxMessage.count({
        where: {
          contactId: contact.id,
          direction: 'inbound',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })

      // Create conversation record
      const conversation = await prisma.conversation.create({
        data: {
          contact_id: contact.id,
          phone_number: phoneNumber,
          channel: 'sms',
          status: 'active',
          priority: 'normal',
          message_count: messageStats._count.id,
          unread_count: unreadCount,
          last_message_at: latestMessage?.createdAt || new Date(),
          created_at: latestMessage?.createdAt || new Date(),
          updated_at: new Date(),
        }
      })

      console.log(`✅ Created conversation for ${contact.firstName} ${contact.lastName} (${messageStats._count.id} messages)`)
    }

    console.log('🎉 Conversation creation completed!')
    
    // Show summary
    const totalConversations = await prisma.conversation.count()
    console.log(`📊 Total conversations in database: ${totalConversations}`)

  } catch (error) {
    console.error('❌ Error creating conversations:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the function
createConversationsFromMessages()

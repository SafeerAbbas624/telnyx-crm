import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    console.log('Starting database seeding...');

    // Get existing contacts to use their IDs
    const existingContacts = await prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true, phone1: true }
    });

    if (existingContacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found. Please add some contacts first.' },
        { status: 400 }
      );
    }

    console.log(`Found ${existingContacts.length} existing contacts`);

    // Helper function to get random contact
    const getRandomContact = () => existingContacts[Math.floor(Math.random() * existingContacts.length)];

    // Helper function to get random date in the past
    const getRandomPastDate = (daysBack: number) => {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
      return date;
    };

    // Helper function to get random future date
    const getRandomFutureDate = (daysAhead: number) => {
      const date = new Date();
      date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
      return date;
    };

    // Seed Messages
    console.log('Seeding messages...');
    const messagePromises = [];
    for (let i = 0; i < 150; i++) {
      const contact = getRandomContact();
      const isOutbound = Math.random() > 0.4; // 60% outbound, 40% inbound
      
      const messageTexts = [
        "Hi! I saw your property listing and I'm interested in learning more.",
        "Thanks for reaching out! When would be a good time to discuss?",
        "I have a cash offer for your property. Are you interested?",
        "Can we schedule a call to discuss the details?",
        "I'm looking for properties in your area. Do you have anything available?",
        "Thank you for your interest. Let me get back to you with more information.",
        "What's the best way to reach you for a quick conversation?",
        "I have some questions about the property. Can you help?",
        "Perfect! I'll send you the details shortly.",
        "Let me know if you need any additional information.",
        "Are you still interested in selling your property?",
        "I can close quickly if the price is right.",
        "Thanks for the quick response!",
        "When would be a good time for a property viewing?",
        "I have financing pre-approved and ready to move forward."
      ];

      messagePromises.push(
        prisma.message.create({
          data: {
            contact_id: contact.id,
            direction: isOutbound ? 'outbound' : 'inbound',
            content: messageTexts[Math.floor(Math.random() * messageTexts.length)],
            timestamp: getRandomPastDate(30),
            status: ['sent', 'delivered', 'read'][Math.floor(Math.random() * 3)] as any,
            message_type: 'sms',
            phone_number: contact.phone1 || '+1234567890',
            segments: 1,
          }
        })
      );
    }
    await Promise.all(messagePromises);
    console.log('Messages seeded successfully');

    // Seed Calls
    console.log('Seeding calls...');
    const callPromises = [];
    for (let i = 0; i < 80; i++) {
      const contact = getRandomContact();
      const isOutbound = Math.random() > 0.3; // 70% outbound, 30% inbound
      const duration = Math.floor(Math.random() * 1800); // 0-30 minutes
      
      const callStatuses = ['completed', 'missed', 'voicemail', 'no_answer', 'busy'];
      const status = callStatuses[Math.floor(Math.random() * callStatuses.length)];

      callPromises.push(
        prisma.call.create({
          data: {
            contact_id: contact.id,
            direction: isOutbound ? 'outbound' : 'inbound',
            duration: status === 'completed' ? duration : 0,
            timestamp: getRandomPastDate(45),
            status: status as any,
            call_type: 'voice',
            from_number: isOutbound ? '+1234567890' : contact.phone1,
            to_number: isOutbound ? contact.phone1 : '+1234567890',
            notes: status === 'completed' ? 'Good conversation about property interest' : null,
          }
        })
      );
    }
    await Promise.all(callPromises);
    console.log('Calls seeded successfully');

    // Seed Activities
    console.log('Seeding activities...');
    const activityPromises = [];
    const activityTypes = ['call', 'meeting', 'email', 'text', 'task', 'follow_up', 'appointment'];
    const activityTitles = {
      call: ['Follow-up call', 'Initial contact call', 'Property discussion call', 'Closing call'],
      meeting: ['Property viewing', 'Contract signing', 'Initial meeting', 'Final walkthrough'],
      email: ['Send property details', 'Contract review', 'Follow-up email', 'Thank you email'],
      text: ['Send property photos', 'Confirm appointment', 'Quick check-in', 'Price update'],
      task: ['Prepare contract', 'Research property', 'Schedule inspection', 'Update CRM'],
      follow_up: ['Weekly check-in', 'Post-meeting follow-up', 'Contract follow-up', 'Interest follow-up'],
      appointment: ['Property showing', 'Contract meeting', 'Inspection appointment', 'Closing appointment']
    };

    for (let i = 0; i < 120; i++) {
      const contact = getRandomContact();
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)] as any;
      const titles = activityTitles[type as keyof typeof activityTitles];
      const title = titles[Math.floor(Math.random() * titles.length)];
      
      const isCompleted = Math.random() > 0.3; // 70% completed
      const isPast = Math.random() > 0.4; // 60% in past, 40% in future
      
      activityPromises.push(
        prisma.activity.create({
          data: {
            contact_id: contact.id,
            type: type,
            title: title,
            description: `${title} with ${contact.firstName} ${contact.lastName}`,
            due_date: isPast ? getRandomPastDate(60) : getRandomFutureDate(30),
            status: isCompleted ? 'completed' : (isPast ? 'overdue' : 'planned') as any,
            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
            duration_minutes: type === 'call' ? 30 : (type === 'meeting' ? 60 : null),
            completed_at: isCompleted ? getRandomPastDate(30) : null,
            result: isCompleted ? 'Successfully completed' : null,
          }
        })
      );
    }
    await Promise.all(activityPromises);
    console.log('Activities seeded successfully');

    // Seed Emails
    console.log('Seeding emails...');
    const emailPromises = [];
    const emailSubjects = [
      'Property Investment Opportunity',
      'Follow-up on Your Property',
      'Cash Offer for Your Home',
      'Property Valuation Report',
      'Meeting Confirmation',
      'Contract Documents',
      'Thank You for Your Time',
      'Property Market Update',
      'Investment Portfolio Review',
      'Closing Documents Ready'
    ];

    const emailBodies = [
      'Thank you for your interest in our services. I wanted to follow up on our recent conversation.',
      'I hope this email finds you well. I have some exciting opportunities to share with you.',
      'As discussed, I am attaching the property details for your review.',
      'I wanted to provide you with an update on the current market conditions in your area.',
      'Please find attached the documents we discussed during our meeting.',
      'I appreciate the time you took to speak with me today. Here are the next steps.',
      'Based on our conversation, I believe we have some great options for you.',
      'I wanted to reach out and see if you had any questions about our previous discussion.',
      'Thank you for considering our services. I look forward to working with you.',
      'I hope you found our meeting productive. Please let me know if you need any additional information.'
    ];

    for (let i = 0; i < 60; i++) {
      const contact = getRandomContact();
      const isOutbound = Math.random() > 0.2; // 80% outbound, 20% inbound
      
      emailPromises.push(
        prisma.email.create({
          data: {
            contact_id: contact.id,
            direction: isOutbound ? 'outbound' : 'inbound',
            subject: emailSubjects[Math.floor(Math.random() * emailSubjects.length)],
            body: emailBodies[Math.floor(Math.random() * emailBodies.length)],
            timestamp: getRandomPastDate(45),
            status: ['sent', 'delivered', 'read'][Math.floor(Math.random() * 3)] as any,
            from_email: isOutbound ? 'agent@adlercapital.com' : `${contact.firstName?.toLowerCase()}@email.com`,
            to_email: isOutbound ? `${contact.firstName?.toLowerCase()}@email.com` : 'agent@adlercapital.com',
          }
        })
      );
    }
    await Promise.all(emailPromises);
    console.log('Emails seeded successfully');

    // Seed Deals
    console.log('Seeding deals...');
    const dealPromises = [];
    const dealStages = ['lead', 'qualified', 'proposal', 'negotiation', 'contract', 'closing', 'closed_won', 'closed_lost'];
    
    for (let i = 0; i < 40; i++) {
      const contact = getRandomContact();
      const stage = dealStages[Math.floor(Math.random() * dealStages.length)] as any;
      const value = Math.floor(Math.random() * 500000) + 50000; // $50k - $550k
      const probability = stage === 'closed_won' ? 100 : 
                         stage === 'closed_lost' ? 0 :
                         Math.floor(Math.random() * 80) + 10; // 10-90%

      dealPromises.push(
        prisma.deal.create({
          data: {
            contact_id: contact.id,
            name: `${contact.firstName} ${contact.lastName} - Property Deal`,
            stage: stage,
            value: value,
            probability: probability,
            expected_close_date: stage.includes('closed') ? getRandomPastDate(30) : getRandomFutureDate(60),
            actual_close_date: stage.includes('closed') ? getRandomPastDate(30) : null,
            source: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Advertisement'][Math.floor(Math.random() * 5)],
            lead_score: Math.floor(Math.random() * 100),
            next_step: stage.includes('closed') ? null : 'Follow up with client',
            notes: `Deal for property investment with ${contact.firstName} ${contact.lastName}`,
          }
        })
      );
    }
    await Promise.all(dealPromises);
    console.log('Deals seeded successfully');

    // Seed Conversations
    console.log('Seeding conversations...');
    const conversationPromises = [];
    const usedPhoneNumbers = new Set();
    
    for (let i = 0; i < Math.min(50, existingContacts.length); i++) {
      const contact = existingContacts[i];
      if (contact.phone1 && !usedPhoneNumbers.has(contact.phone1)) {
        usedPhoneNumbers.add(contact.phone1);
        
        conversationPromises.push(
          prisma.conversation.create({
            data: {
              contact_id: contact.id,
              phone_number: contact.phone1,
              channel: 'sms',
              last_message_content: 'Thanks for reaching out! I\'ll get back to you soon.',
              last_message_at: getRandomPastDate(7),
              last_message_direction: Math.random() > 0.5 ? 'outbound' : 'inbound',
              message_count: Math.floor(Math.random() * 20) + 1,
              unread_count: Math.floor(Math.random() * 3),
              status: 'active',
              priority: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)] as any,
            }
          })
        );
      }
    }
    await Promise.all(conversationPromises);
    console.log('Conversations seeded successfully');

    // Get final counts
    const finalCounts = {
      contacts: await prisma.contact.count(),
      messages: await prisma.message.count(),
      calls: await prisma.call.count(),
      activities: await prisma.activity.count(),
      emails: await prisma.email.count(),
      deals: await prisma.deal.count(),
      conversations: await prisma.conversation.count(),
    };

    console.log('Database seeding completed successfully!');
    console.log('Final counts:', finalCounts);

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      counts: finalCounts
    });

  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Optional: Add a GET endpoint to check current counts
export async function GET() {
  try {
    const counts = {
      contacts: await prisma.contact.count(),
      messages: await prisma.message.count(),
      calls: await prisma.call.count(),
      activities: await prisma.activity.count(),
      emails: await prisma.email.count(),
      deals: await prisma.deal.count(),
      conversations: await prisma.conversation.count(),
    };

    return NextResponse.json({
      success: true,
      message: 'Current database counts',
      counts
    });
  } catch (error) {
    console.error('Error getting database counts:', error);
    return NextResponse.json(
      { error: 'Failed to get database counts' },
      { status: 500 }
    );
  }
}
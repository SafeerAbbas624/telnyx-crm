import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// DISABLED: This endpoint was creating duplicate test emails
// If you need to test emails, use the email compose feature in the UI
export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'This debug endpoint has been disabled to prevent duplicate email creation',
    message: 'Use the email compose feature in the UI to send test emails'
  }, { status: 403 })
}

// Original implementation kept for reference but disabled
async function _createTestEmail_DISABLED(request: NextRequest) {
  try {
    console.log('Creating test email message...')

    // Get a sample contact
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { email1: { not: null } },
          { email2: { not: null } },
          { email3: { not: null } },
        ]
      }
    })

    if (!contact) {
      return NextResponse.json({
        error: 'No contacts with email addresses found'
      }, { status: 400 })
    }

    // Get or create an email account
    let emailAccount = await prisma.emailAccount.findFirst({
      where: { status: 'active' }
    })

    if (!emailAccount) {
      // Create a test email account
      emailAccount = await prisma.emailAccount.create({
        data: {
          emailAddress: 'test@example.com',
          displayName: 'Test Account',
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpEncryption: 'TLS',
          smtpUsername: 'test@example.com',
          smtpPassword: 'encrypted_password',
          status: 'active',
        }
      })
    }

    // Create a test email message
    const testEmail = await prisma.emailMessage.create({
      data: {
        contactId: contact.id,
        emailAccountId: emailAccount.id,
        direction: 'outbound',
        fromEmail: emailAccount.emailAddress,
        fromName: emailAccount.displayName,
        toEmails: [contact.email1 || contact.email2 || contact.email3 || 'test@example.com'],
        subject: 'Test Email - Property Follow-up',
        content: `<p>Hi ${contact.firstName || 'there'},</p><p>This is a test email to verify the email system is working correctly.</p><p>Best regards,<br>Real Estate Team</p>`,
        textContent: `Hi ${contact.firstName || 'there'},\n\nThis is a test email to verify the email system is working correctly.\n\nBest regards,\nReal Estate Team`,
        status: 'sent',
        sentAt: new Date(),
      }
    })

    // Create another inbound test email
    const inboundEmail = await prisma.emailMessage.create({
      data: {
        contactId: contact.id,
        emailAccountId: emailAccount.id,
        direction: 'inbound',
        fromEmail: contact.email1 || contact.email2 || contact.email3 || 'contact@example.com',
        fromName: `${contact.firstName} ${contact.lastName}`,
        toEmails: [emailAccount.emailAddress],
        subject: 'Re: Property Inquiry',
        content: `<p>Thank you for reaching out about the property. I'm interested in learning more.</p><p>Best regards,<br>${contact.firstName} ${contact.lastName}</p>`,
        textContent: `Thank you for reaching out about the property. I'm interested in learning more.\n\nBest regards,\n${contact.firstName} ${contact.lastName}`,
        status: 'delivered',
        sentAt: new Date(Date.now() - 3600000), // 1 hour ago
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Test emails created successfully',
      data: {
        contact: {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`,
          email: contact.email1 || contact.email2 || contact.email3,
        },
        emailAccount: {
          id: emailAccount.id,
          emailAddress: emailAccount.emailAddress,
        },
        createdEmails: [
          {
            id: testEmail.id,
            subject: testEmail.subject,
            direction: testEmail.direction,
          },
          {
            id: inboundEmail.id,
            subject: inboundEmail.subject,
            direction: inboundEmail.direction,
          }
        ]
      }
    })

  } catch (error) {
    console.error('Error creating test email:', error)
    return NextResponse.json({
      error: 'Failed to create test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// This endpoint should be called by a cron job daily
// It permanently deletes conversations that have been in trash for more than 30 days
export async function POST(request: NextRequest) {
  try {
    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Find conversations deleted more than 30 days ago
    const conversationsToDelete = await prisma.emailConversation.findMany({
      where: {
        deletedAt: {
          lte: thirtyDaysAgo
        }
      },
      select: {
        id: true,
        contactId: true,
        emailAddress: true
      }
    })

    console.log(`🗑️ Found ${conversationsToDelete.length} conversations to permanently delete`)

    // Delete messages for these conversations
    for (const conversation of conversationsToDelete) {
      await prisma.emailMessage.deleteMany({
        where: {
          contactId: conversation.contactId,
          OR: [
            { fromEmail: conversation.emailAddress },
            { toEmails: { has: conversation.emailAddress } }
          ]
        }
      })
    }

    // Delete the conversations
    const result = await prisma.emailConversation.deleteMany({
      where: {
        deletedAt: {
          lte: thirtyDaysAgo
        }
      }
    })

    console.log(`✅ Permanently deleted ${result.count} conversations from trash`)

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Permanently deleted ${result.count} conversations from trash`
    })
  } catch (error: any) {
    console.error('Error cleaning up trash:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup trash', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check how many conversations are eligible for deletion
export async function GET(request: NextRequest) {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const count = await prisma.emailConversation.count({
      where: {
        deletedAt: {
          lte: thirtyDaysAgo
        }
      }
    })

    return NextResponse.json({
      eligibleForDeletion: count,
      cutoffDate: thirtyDaysAgo.toISOString()
    })
  } catch (error: any) {
    console.error('Error checking trash:', error)
    return NextResponse.json(
      { error: 'Failed to check trash', details: error.message },
      { status: 500 }
    )
  }
}


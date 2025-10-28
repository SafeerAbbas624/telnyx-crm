import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Cleanup endpoint to delete conversations with no messages
 * This removes orphaned conversation records that have no associated TelnyxMessage entries
 * 
 * Usage (logged in as Admin):
 * POST /api/admin/cleanup-empty-conversations
 * Body: { dryRun: true, batchSize: 500 }
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { dryRun = true, batchSize = 500 } = await req.json().catch(() => ({ dryRun: true, batchSize: 500 }))

      console.log(`🧹 Starting cleanup of empty conversations (dryRun: ${dryRun})`)

      let page = 0
      let processed = 0
      let deleted = 0

      while (true) {
        // Get batch of conversations
        const convs = await prisma.conversation.findMany({
          skip: page * batchSize,
          take: batchSize,
          select: {
            id: true,
            contact_id: true,
            phone_number: true,
            unread_count: true,
          }
        })

        if (convs.length === 0) break

        for (const conv of convs) {
          processed++

          // Check if this conversation has any messages
          const messageCount = await prisma.telnyxMessage.count({
            where: {
              OR: [
                { contactId: conv.contact_id },
                {
                  AND: [
                    { toNumber: conv.phone_number },
                    { direction: 'outbound' }
                  ]
                },
                {
                  AND: [
                    { fromNumber: conv.phone_number },
                    { direction: 'inbound' }
                  ]
                }
              ]
            }
          })

          // If no messages found, delete the conversation
          if (messageCount === 0) {
            console.log(`🗑️  Deleting empty conversation ${conv.id} (contact: ${conv.contact_id}, phone: ${conv.phone_number})`)
            
            if (!dryRun) {
              await prisma.conversation.delete({
                where: { id: conv.id }
              })
            }
            deleted++
          }
        }

        page++
      }

      const message = dryRun 
        ? `[DRY RUN] Would delete ${deleted} empty conversations out of ${processed} total`
        : `Deleted ${deleted} empty conversations out of ${processed} total`

      console.log(`✅ ${message}`)

      return NextResponse.json({
        success: true,
        dryRun,
        processed,
        deleted,
        message
      })
    } catch (e: any) {
      console.error('Conversation cleanup failed:', e)
      return NextResponse.json(
        { success: false, error: e?.message || 'Unknown error' },
        { status: 500 }
      )
    }
  })
}

/**
 * GET endpoint to check how many empty conversations exist
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      // Get all conversations
      const conversations = await prisma.conversation.findMany({
        select: {
          id: true,
          contact_id: true,
          phone_number: true,
        }
      })

      let emptyCount = 0
      const emptyConversations = []

      // Check each conversation for messages
      for (const conv of conversations) {
        const messageCount = await prisma.telnyxMessage.count({
          where: {
            OR: [
              { contactId: conv.contact_id },
              {
                AND: [
                  { toNumber: conv.phone_number },
                  { direction: 'outbound' }
                ]
              },
              {
                AND: [
                  { fromNumber: conv.phone_number },
                  { direction: 'inbound' }
                ]
              }
            ]
          }
        })

        if (messageCount === 0) {
          emptyCount++
          emptyConversations.push({
            id: conv.id,
            contactId: conv.contact_id,
            phoneNumber: conv.phone_number
          })
        }
      }

      return NextResponse.json({
        totalConversations: conversations.length,
        emptyConversations: emptyCount,
        details: emptyConversations.slice(0, 10), // Show first 10
        message: `Found ${emptyCount} empty conversations out of ${conversations.length} total`
      })
    } catch (e: any) {
      console.error('Error checking empty conversations:', e)
      return NextResponse.json(
        { error: 'Failed to check conversations', details: e?.message },
        { status: 500 }
      )
    }
  })
}


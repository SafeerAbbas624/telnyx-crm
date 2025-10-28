/**
 * Backfill Call Costs Script
 * 
 * This script estimates and backfills costs for existing calls that don't have cost data.
 * It uses the TELNYX_VOICE_RATE_PER_MIN environment variable to calculate costs.
 * 
 * Usage: npx tsx scripts/backfill-call-costs.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillCallCosts() {
  try {
    console.log('🔍 Starting call cost backfill process...\n')

    // Get the rate from environment variable
    const ratePerMin = parseFloat(process.env.TELNYX_VOICE_RATE_PER_MIN || '0.015')
    console.log(`📊 Using rate: $${ratePerMin} per minute\n`)

    // Find all calls without cost data
    const callsWithoutCost = await prisma.telnyxCall.findMany({
      where: {
        cost: null,
        duration: {
          gt: 0
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`📞 Found ${callsWithoutCost.length} calls without cost data\n`)

    if (callsWithoutCost.length === 0) {
      console.log('✅ All calls already have cost data!')
      return
    }

    let totalEstimatedCost = 0
    let updatedCount = 0

    for (const call of callsWithoutCost) {
      // Calculate cost based on duration
      const durationMinutes = Math.max(1, Math.ceil((call.duration || 0) / 60))
      const estimatedCost = durationMinutes * ratePerMin

      console.log(`📞 Call ${call.id.substring(0, 8)}...`)
      console.log(`   From: ${call.fromNumber} → To: ${call.toNumber}`)
      console.log(`   Duration: ${call.duration}s (${durationMinutes} min)`)
      console.log(`   Estimated Cost: $${estimatedCost.toFixed(4)}`)

      // Update call record with estimated cost
      await prisma.telnyxCall.update({
        where: { id: call.id },
        data: {
          cost: estimatedCost
        }
      })

      // Create billing record
      await prisma.telnyxBilling.create({
        data: {
          phoneNumber: call.fromNumber,
          recordType: 'call',
          recordId: call.telnyxCallId || call.id,
          cost: estimatedCost,
          currency: 'USD',
          billingDate: call.createdAt,
          description: `Call to ${call.toNumber} (${call.duration}s) [estimated @ $${ratePerMin}/min]`,
          metadata: {
            estimated: true,
            ratePerMin: ratePerMin,
            source: 'backfill-script',
            backfilledAt: new Date().toISOString()
          }
        }
      })

      // Update phone number total cost
      await prisma.telnyxPhoneNumber.updateMany({
        where: { phoneNumber: call.fromNumber },
        data: {
          totalCost: { increment: estimatedCost }
        }
      })

      totalEstimatedCost += estimatedCost
      updatedCount++
      console.log(`   ✅ Updated\n`)
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Backfill complete!`)
    console.log(`   Updated: ${updatedCount} calls`)
    console.log(`   Total Estimated Cost: $${totalEstimatedCost.toFixed(4)}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('📝 Note: These are estimated costs based on duration.')
    console.log('   Enable "Call Cost" webhook in Telnyx for accurate future costs.\n')

  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
backfillCallCosts()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })


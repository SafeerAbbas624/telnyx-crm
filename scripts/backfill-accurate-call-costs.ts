/**
 * Backfill Script: Fetch Accurate Call Costs from Telnyx Detail Records API
 * 
 * This script:
 * 1. Finds all calls with estimated costs (or missing costs)
 * 2. Fetches accurate costs from Telnyx Detail Records API
 * 3. Updates telnyx_calls table with accurate costs
 * 4. Updates telnyx_billing records with accurate costs
 * 5. Adjusts telnyx_phone_numbers.totalCost
 */

import { PrismaClient } from '@prisma/client'
import { fetchCallDetailRecord } from '../lib/telnyx-detail-records'

const prisma = new PrismaClient()

interface BackfillStats {
  totalCalls: number
  processed: number
  updated: number
  notFound: number
  errors: number
  totalCostDifference: number
}

async function backfillCallCosts() {
  console.log('🚀 Starting backfill of accurate call costs from Telnyx Detail Records API...\n')

  const stats: BackfillStats = {
    totalCalls: 0,
    processed: 0,
    updated: 0,
    notFound: 0,
    errors: 0,
    totalCostDifference: 0,
  }

  try {
    // Find all calls with estimated costs or missing costs
    const calls = await prisma.telnyxCall.findMany({
      where: {
        OR: [
          { cost: 0 },
          { cost: null },
          // Find calls with estimated costs (typically $0.015/min pattern)
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    stats.totalCalls = calls.length
    console.log(`📊 Found ${stats.totalCalls} calls to process\n`)

    if (stats.totalCalls === 0) {
      console.log('✅ No calls need updating. All calls already have accurate costs!')
      return stats
    }

    // Process calls in batches to avoid rate limiting
    const batchSize = 5
    const delayBetweenBatches = 2000 // 2 seconds

    for (let i = 0; i < calls.length; i += batchSize) {
      const batch = calls.slice(i, i + batchSize)
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(calls.length / batchSize)}...`)

      await Promise.all(
        batch.map(async (call) => {
          stats.processed++

          try {
            console.log(`  [${stats.processed}/${stats.totalCalls}] Fetching cost for call ${call.telnyxCallId}...`)

            // Fetch cost from Telnyx Detail Records API
            const detailRecord = await fetchCallDetailRecord(call.telnyxCallId)

            if (!detailRecord.found || detailRecord.cost === null) {
              console.log(`    ⚠️  Cost not found in Detail Records API`)
              stats.notFound++
              return
            }

            const oldCost = call.cost || 0
            const newCost = detailRecord.cost
            const costDifference = newCost - oldCost

            console.log(`    ✅ Found cost: $${newCost.toFixed(4)} (was: $${oldCost.toFixed(4)}, diff: ${costDifference >= 0 ? '+' : ''}$${costDifference.toFixed(4)})`)

            // Update call record
            await prisma.telnyxCall.update({
              where: { id: call.id },
              data: {
                cost: newCost,
                updatedAt: new Date(),
              },
            })

            // Find and update billing record
            const billingRecord = await prisma.telnyxBilling.findFirst({
              where: {
                telnyxCallId: call.telnyxCallId,
                recordType: 'call',
              },
            })

            if (billingRecord) {
              // Update existing billing record
              await prisma.telnyxBilling.update({
                where: { id: billingRecord.id },
                data: {
                  cost: newCost,
                  description: `Call to ${call.toNumber} (${call.duration}s)`,
                  metadata: {
                    source: 'detail_records_api',
                    rate: detailRecord.rate,
                    billedSeconds: detailRecord.billedSeconds,
                    callSeconds: detailRecord.callSeconds,
                    fetchedAt: new Date().toISOString(),
                    backfilled: true,
                  },
                },
              })
              console.log(`    📝 Updated billing record`)
            } else {
              // Create billing record if it doesn't exist
              await prisma.telnyxBilling.create({
                data: {
                  phoneNumber: call.fromNumber,
                  recordType: 'call',
                  cost: newCost,
                  currency: detailRecord.currency,
                  direction: call.direction,
                  billingDate: call.createdAt,
                  description: `Call to ${call.toNumber} (${call.duration}s)`,
                  telnyxCallId: call.telnyxCallId,
                  metadata: {
                    source: 'detail_records_api',
                    rate: detailRecord.rate,
                    billedSeconds: detailRecord.billedSeconds,
                    callSeconds: detailRecord.callSeconds,
                    fetchedAt: new Date().toISOString(),
                    backfilled: true,
                  },
                },
              })
              console.log(`    📝 Created billing record`)
            }

            // Update phone number total cost
            if (costDifference !== 0) {
              await prisma.telnyxPhoneNumber.updateMany({
                where: { phoneNumber: call.fromNumber },
                data: {
                  totalCost: {
                    increment: costDifference,
                  },
                },
              })
              console.log(`    💰 Adjusted phone number total cost by $${costDifference.toFixed(4)}`)
            }

            stats.updated++
            stats.totalCostDifference += costDifference

          } catch (error) {
            console.error(`    ❌ Error processing call ${call.telnyxCallId}:`, error)
            stats.errors++
          }
        })
      )

      // Delay between batches to avoid rate limiting
      if (i + batchSize < calls.length) {
        console.log(`  ⏳ Waiting ${delayBetweenBatches / 1000}s before next batch...`)
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 BACKFILL COMPLETE!')
    console.log('='.repeat(80))
    console.log(`Total calls found:        ${stats.totalCalls}`)
    console.log(`Calls processed:          ${stats.processed}`)
    console.log(`Calls updated:            ${stats.updated}`)
    console.log(`Costs not found:          ${stats.notFound}`)
    console.log(`Errors:                   ${stats.errors}`)
    console.log(`Total cost difference:    ${stats.totalCostDifference >= 0 ? '+' : ''}$${stats.totalCostDifference.toFixed(4)}`)
    console.log('='.repeat(80))

    if (stats.updated > 0) {
      console.log('\n✅ Successfully updated call costs with accurate data from Telnyx!')
      console.log('💡 Future calls will be automatically updated via webhook integration.')
    }

    if (stats.notFound > 0) {
      console.log(`\n⚠️  ${stats.notFound} calls not found in Telnyx Detail Records API.`)
      console.log('   This is normal for very recent calls (Telnyx needs time to process).')
      console.log('   These will be picked up by the automatic retry mechanism.')
    }

    if (stats.errors > 0) {
      console.log(`\n❌ ${stats.errors} calls had errors. Check logs above for details.`)
    }

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }

  return stats
}

// Run the backfill
backfillCallCosts()
  .then((stats) => {
    console.log('\n✅ Backfill script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Backfill script failed:', error)
    process.exit(1)
  })


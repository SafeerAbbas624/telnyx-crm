const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function removeRedundantTables() {
  try {
    console.log('🧹 Removing redundant database tables...')

    // Check if the old tables exist and have data
    try {
      const messageCount = await prisma.message.count()
      const callCount = await prisma.call.count()
      
      console.log(`📊 Found ${messageCount} records in old Message table`)
      console.log(`📊 Found ${callCount} records in old Call table`)
      
      if (messageCount > 0 || callCount > 0) {
        console.log('⚠️  Old tables contain data. Please migrate data first if needed.')
        console.log('⚠️  Continuing with table removal...')
      }
    } catch (error) {
      console.log('ℹ️  Old tables may not exist or are already removed.')
    }

    // Drop the old tables using raw SQL
    try {
      await prisma.$executeRaw`DROP TABLE IF EXISTS "Message" CASCADE;`
      console.log('✅ Dropped old Message table')
    } catch (error) {
      console.log('ℹ️  Message table may not exist:', error.message)
    }

    try {
      await prisma.$executeRaw`DROP TABLE IF EXISTS "Call" CASCADE;`
      console.log('✅ Dropped old Call table')
    } catch (error) {
      console.log('ℹ️  Call table may not exist:', error.message)
    }

    console.log('🎉 Redundant table cleanup completed!')
    console.log('📋 Active tables for timeline:')
    console.log('   - TelnyxMessage (for SMS)')
    console.log('   - TelnyxCall (for calls)')
    console.log('   - Email (for emails)')
    console.log('   - Activity (for activities)')

  } catch (error) {
    console.error('❌ Error removing redundant tables:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the function
removeRedundantTables()

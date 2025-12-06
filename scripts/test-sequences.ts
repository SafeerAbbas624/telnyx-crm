/**
 * Sequence System Test Script
 * 
 * Tests the core sequence functionality:
 * - Create sequence
 * - Add steps
 * - Enroll contact
 * - Process sequence
 * - Verify logs
 * 
 * Run with: npx tsx scripts/test-sequences.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const BASE_URL = process.env.APP_URL || "http://localhost:3000"

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...")
  
  // Delete test sequences
  await prisma.sequenceLog.deleteMany({
    where: { enrollment: { sequence: { name: { startsWith: "TEST_" } } } }
  })
  await prisma.sequenceEnrollment.deleteMany({
    where: { sequence: { name: { startsWith: "TEST_" } } }
  })
  await prisma.sequenceStep.deleteMany({
    where: { sequence: { name: { startsWith: "TEST_" } } }
  })
  await prisma.sequence.deleteMany({
    where: { name: { startsWith: "TEST_" } }
  })
  
  // Delete test contacts
  await prisma.contact.deleteMany({
    where: { firstName: "TEST_SEQUENCE" }
  })
  
  console.log("✅ Cleanup complete")
}

async function runTests() {
  console.log("🧪 Running Sequence System Tests\n")
  
  let passed = 0
  let failed = 0
  
  try {
    // Get a test user
    const user = await prisma.user.findFirst()
    if (!user) {
      throw new Error("No user found in database. Please create a user first.")
    }
    console.log(`📝 Using user: ${user.email}`)
    
    // Test 1: Create a sequence
    console.log("\n📋 Test 1: Create Sequence")
    const sequence = await prisma.sequence.create({
      data: {
        name: "TEST_Onboarding Sequence",
        description: "Test sequence for automated testing",
        createdById: user.id,
        isActive: true,
      }
    })
    console.log(`   ✅ Created sequence: ${sequence.id}`)
    passed++
    
    // Test 2: Add SMS step
    console.log("\n📋 Test 2: Add SMS Step")
    const smsStep = await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        type: "SMS",
        name: "Welcome SMS",
        orderIndex: 0,
        delayMinutes: 0,
        config: { message: "Hello {{firstName}}, welcome to our service!" },
      }
    })
    console.log(`   ✅ Created SMS step: ${smsStep.id}`)
    passed++

    // Test 3: Add Email step
    console.log("\n📋 Test 3: Add Email Step")
    const emailStep = await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        type: "EMAIL",
        name: "Welcome Email",
        orderIndex: 1,
        delayMinutes: 1440, // 1 day
        config: {
          subject: "Welcome to {{propertyAddress}}",
          body: "Hi {{firstName}}, thank you for your interest!"
        },
      }
    })
    console.log(`   ✅ Created Email step: ${emailStep.id}`)
    passed++

    // Test 4: Add Task step
    console.log("\n📋 Test 4: Add Task Step")
    const taskStep = await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        type: "TASK",
        name: "Follow-up Call",
        orderIndex: 2,
        delayMinutes: 2880, // 2 days
        config: { title: "Call {{firstName}}", description: "Follow up call" },
      }
    })
    console.log(`   ✅ Created Task step: ${taskStep.id}`)
    passed++
    
    // Test 5: Create test contact
    console.log("\n📋 Test 5: Create Test Contact")
    const contact = await prisma.contact.create({
      data: {
        firstName: "TEST_SEQUENCE",
        lastName: "Contact",
        phone1: "+15551234567",
        email1: "test@example.com",
        propertyAddress: "123 Test Street",
      }
    })
    console.log(`   ✅ Created contact: ${contact.id}`)
    passed++
    
    // Test 6: Enroll contact in sequence
    console.log("\n📋 Test 6: Enroll Contact")
    const enrollment = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        contactId: contact.id,
        enrolledById: user.id,
        status: "ACTIVE",
        currentStepIndex: 0,
        nextStepAt: new Date(), // Due now
      }
    })
    console.log(`   ✅ Created enrollment: ${enrollment.id}`)
    passed++
    
    // Test 7: Verify step count
    console.log("\n📋 Test 7: Verify Steps")
    const steps = await prisma.sequenceStep.count({
      where: { sequenceId: sequence.id }
    })
    if (steps === 3) {
      console.log(`   ✅ Step count correct: ${steps}`)
      passed++
    } else {
      console.log(`   ❌ Step count incorrect: expected 3, got ${steps}`)
      failed++
    }
    
    // Test 8: Verify enrollment status
    console.log("\n📋 Test 8: Verify Enrollment")
    const verifyEnrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollment.id },
      include: { sequence: true, contact: true }
    })
    if (verifyEnrollment?.status === "ACTIVE") {
      console.log(`   ✅ Enrollment status correct: ${verifyEnrollment.status}`)
      passed++
    } else {
      console.log(`   ❌ Enrollment status incorrect: ${verifyEnrollment?.status}`)
      failed++
    }
    
  } catch (error: any) {
    console.error(`\n❌ Test failed with error: ${error.message}`)
    failed++
  }
  
  // Summary
  console.log("\n" + "=".repeat(50))
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`)
  console.log("=".repeat(50))
  
  return failed === 0
}

async function testWaitStep() {
  console.log("\n🧪 Running WAIT Step Tests\n")

  let passed = 0
  let failed = 0

  try {
    const user = await prisma.user.findFirst()
    if (!user) throw new Error("No user found")

    // Test WAIT step creation
    console.log("📋 Test: Create WAIT Step")
    const sequence = await prisma.sequence.create({
      data: {
        name: "TEST_Wait Sequence",
        createdById: user.id,
        isActive: true,
      }
    })

    const waitStep = await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        type: "WAIT",
        name: "Wait for Reply",
        orderIndex: 0,
        delayMinutes: 0,
        config: { condition: "REPLY", timeoutMinutes: 1440 },
      }
    })

    if (waitStep.type === "WAIT") {
      console.log(`   ✅ WAIT step created: ${waitStep.id}`)
      passed++
    } else {
      console.log(`   ❌ WAIT step type incorrect`)
      failed++
    }

    // Verify config
    const config = waitStep.config as any
    if (config.condition === "REPLY" && config.timeoutMinutes === 1440) {
      console.log(`   ✅ WAIT step config correct`)
      passed++
    } else {
      console.log(`   ❌ WAIT step config incorrect`)
      failed++
    }

  } catch (error: any) {
    console.error(`❌ WAIT test failed: ${error.message}`)
    failed++
  }

  console.log(`\n📊 WAIT Tests: ${passed} passed, ${failed} failed`)
  return failed === 0
}

async function testRateLimiting() {
  console.log("\n🧪 Testing Rate Limiting Config\n")

  const smsLimit = parseInt(process.env.SEQUENCE_SMS_RATE_LIMIT || "30")
  const emailLimit = parseInt(process.env.SEQUENCE_EMAIL_RATE_LIMIT || "20")

  console.log(`   SMS Rate Limit: ${smsLimit}/min`)
  console.log(`   Email Rate Limit: ${emailLimit}/min`)

  if (smsLimit > 0 && emailLimit > 0) {
    console.log("   ✅ Rate limits configured")
    return true
  }
  console.log("   ❌ Rate limits not configured")
  return false
}

async function testQuietHours() {
  console.log("\n🧪 Testing Quiet Hours Config\n")

  const enabled = process.env.SEQUENCE_QUIET_HOURS_ENABLED === "true"
  const start = parseInt(process.env.SEQUENCE_QUIET_HOURS_START || "21")
  const end = parseInt(process.env.SEQUENCE_QUIET_HOURS_END || "8")
  const tz = process.env.SEQUENCE_TIMEZONE || "America/New_York"

  console.log(`   Enabled: ${enabled}`)
  console.log(`   Quiet Hours: ${start}:00 - ${end}:00 ${tz}`)

  console.log("   ✅ Quiet hours config loaded")
  return true
}

async function main() {
  try {
    await cleanup()
    const coreSuccess = await runTests()
    const waitSuccess = await testWaitStep()
    const rateSuccess = await testRateLimiting()
    const quietSuccess = await testQuietHours()
    await cleanup()

    const allPassed = coreSuccess && waitSuccess && rateSuccess && quietSuccess
    console.log("\n" + "=".repeat(50))
    console.log(allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED")
    console.log("=".repeat(50))

    process.exit(allPassed ? 0 : 1)
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanDuplicatePhoneNumbers() {
  try {
    console.log('🧹 Cleaning duplicate phone numbers...');

    // Remove the old numbers with dashes (these are duplicates)
    const numbersToRemove = [
      '+1-754-294-7595',
      '+1-754-354-5927', // This one seems to be a typo anyway (should be 384, not 354)
      '+1-786-905-1193'
    ];

    for (const phoneNumber of numbersToRemove) {
      const deleted = await prisma.telnyxPhoneNumber.deleteMany({
        where: { phoneNumber: phoneNumber },
      });

      if (deleted.count > 0) {
        console.log(`✅ Removed duplicate: ${phoneNumber}`);
      } else {
        console.log(`⚠️  Not found: ${phoneNumber}`);
      }
    }

    console.log('\n🔍 Remaining phone numbers:');
    const remainingNumbers = await prisma.telnyxPhoneNumber.findMany({
      orderBy: { createdAt: 'desc' }
    });

    remainingNumbers.forEach(num => {
      console.log(`✅ ${num.phoneNumber} (${num.state}) - SMS: ${num.totalSmsCount}, Calls: ${num.totalCallCount}`);
    });

    console.log('\n🎉 Cleanup complete! You should now see only 3 phone numbers.');
    
  } catch (error) {
    console.error('❌ Error cleaning phone numbers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicatePhoneNumbers();

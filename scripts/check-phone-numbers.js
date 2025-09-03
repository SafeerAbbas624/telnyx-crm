const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPhoneNumbers() {
  try {
    console.log('🔍 Checking phone_numbers table...');
    const oldNumbers = await prisma.phoneNumber.findMany();
    console.log('Old phone_numbers table:', oldNumbers);
    
    console.log('\n🔍 Checking telnyx_phone_numbers table...');
    const telnyxNumbers = await prisma.telnyxPhoneNumber.findMany();
    console.log('Telnyx phone_numbers table:', telnyxNumbers);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhoneNumbers();

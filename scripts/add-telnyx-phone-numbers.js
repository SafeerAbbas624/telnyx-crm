const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTelnyxPhoneNumbers() {
  try {
    console.log('🔄 Adding Telnyx phone numbers to database...');

    // Your Telnyx phone numbers from the SIP Connection
    const phoneNumbers = [
      {
        phoneNumber: '+17543845927',
        state: 'FL',
        city: 'Fort Lauderdale',
        capabilities: ['SMS', 'VOICE'],
        isActive: true,
      },
      {
        phoneNumber: '+17869051193',
        state: 'FL', 
        city: 'Miami',
        capabilities: ['SMS', 'VOICE'],
        isActive: true,
      },
      {
        phoneNumber: '+17542947595',
        state: 'FL',
        city: 'Fort Lauderdale', 
        capabilities: ['SMS', 'VOICE'],
        isActive: true,
      }
    ];

    for (const phoneData of phoneNumbers) {
      // Check if phone number already exists
      const existingNumber = await prisma.telnyxPhoneNumber.findUnique({
        where: { phoneNumber: phoneData.phoneNumber },
      });

      if (existingNumber) {
        console.log(`✅ Phone number ${phoneData.phoneNumber} already exists`);
        continue;
      }

      // Create new phone number record
      const newPhoneNumber = await prisma.telnyxPhoneNumber.create({
        data: phoneData,
      });

      console.log(`✅ Added phone number: ${newPhoneNumber.phoneNumber}`);
    }

    console.log('🎉 Successfully added all Telnyx phone numbers!');
    
  } catch (error) {
    console.error('❌ Error adding phone numbers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addTelnyxPhoneNumbers();

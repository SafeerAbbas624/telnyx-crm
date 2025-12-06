/**
 * Migration Script: Assign all existing Telnyx phone numbers to all existing users
 * 
 * This script:
 * 1. Fetches all active Telnyx phone numbers
 * 2. Fetches all users
 * 3. Creates UserAllowedPhoneNumber records for each user-phone combination
 * 4. Sets the first phone number as the default for each user (if not already set)
 * 
 * Run with: npx ts-node scripts/migrate-user-phone-permissions.ts
 * Or: npx tsx scripts/migrate-user-phone-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateUserPhonePermissions() {
  console.log('Starting user phone permissions migration...\n');

  try {
    // 1. Fetch all active phone numbers
    const phoneNumbers = await prisma.telnyxPhoneNumber.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${phoneNumbers.length} active phone numbers`);

    if (phoneNumbers.length === 0) {
      console.log('No phone numbers found. Nothing to migrate.');
      return;
    }

    // 2. Fetch all users
    const users = await prisma.user.findMany({
      include: {
        allowedPhoneNumbers: true,
      },
    });

    console.log(`Found ${users.length} users\n`);

    if (users.length === 0) {
      console.log('No users found. Nothing to migrate.');
      return;
    }

    // 3. For each user, assign all phone numbers
    let totalCreated = 0;
    let totalSkipped = 0;
    let defaultsSet = 0;

    for (const user of users) {
      console.log(`Processing user: ${user.email} (${user.role})`);
      
      const existingPhoneIds = new Set(
        user.allowedPhoneNumbers.map(ap => ap.phoneNumberId)
      );

      // Assign all phone numbers to this user
      for (const phone of phoneNumbers) {
        if (existingPhoneIds.has(phone.id)) {
          totalSkipped++;
          continue;
        }

        await prisma.userAllowedPhoneNumber.create({
          data: {
            userId: user.id,
            phoneNumberId: phone.id,
          },
        });
        totalCreated++;
      }

      // Set default phone number if not already set
      if (!user.defaultPhoneNumberId && phoneNumbers.length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { defaultPhoneNumberId: phoneNumbers[0].id },
        });
        defaultsSet++;
        console.log(`  - Set default phone number: ${phoneNumbers[0].phoneNumber}`);
      }

      console.log(`  - Assigned ${phoneNumbers.length - existingPhoneIds.size} new numbers`);
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Total phone numbers: ${phoneNumbers.length}`);
    console.log(`New permissions created: ${totalCreated}`);
    console.log(`Existing permissions skipped: ${totalSkipped}`);
    console.log(`Default numbers set: ${defaultsSet}`);
    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateUserPhonePermissions()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testPerformance() {
  console.log('🚀 Starting CRM Performance Tests...\n');

  try {
    // Test 1: Basic contact count
    console.log('📊 Test 1: Contact Count');
    const startTime1 = Date.now();
    const totalContacts = await prisma.contact.count();
    const endTime1 = Date.now();
    console.log(`✅ Total contacts: ${totalContacts}`);
    console.log(`⏱️  Query time: ${endTime1 - startTime1}ms\n`);

    // Test 2: Paginated contact fetch (first page)
    console.log('📊 Test 2: Paginated Contact Fetch (Page 1)');
    const startTime2 = Date.now();
    const contactsPage1 = await prisma.contact.findMany({
      include: {
        contact_tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      skip: 0,
    });
    const endTime2 = Date.now();
    console.log(`✅ Fetched ${contactsPage1.length} contacts (page 1)`);
    console.log(`⏱️  Query time: ${endTime2 - startTime2}ms\n`);

    // Test 3: Search query performance
    console.log('📊 Test 3: Search Query Performance');
    const startTime3 = Date.now();
    const searchResults = await prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: 'john', mode: 'insensitive' } },
          { lastName: { contains: 'john', mode: 'insensitive' } },
          { llcName: { contains: 'john', mode: 'insensitive' } },
          { phone1: { contains: 'john' } },
          { email1: { contains: 'john', mode: 'insensitive' } },
        ]
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const endTime3 = Date.now();
    console.log(`✅ Search results: ${searchResults.length} contacts`);
    console.log(`⏱️  Query time: ${endTime3 - startTime3}ms\n`);

    // Test 4: Filter by deal status
    console.log('📊 Test 4: Filter by Deal Status');
    const startTime4 = Date.now();
    const leadContacts = await prisma.contact.findMany({
      where: {
        dealStatus: 'lead'
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const endTime4 = Date.now();
    console.log(`✅ Lead contacts: ${leadContacts.length}`);
    console.log(`⏱️  Query time: ${endTime4 - startTime4}ms\n`);

    // Test 5: Messages for contact (simulating conversation loading)
    if (totalContacts > 0) {
      console.log('📊 Test 5: Messages for Contact');
      const firstContact = await prisma.contact.findFirst({
        select: { id: true, firstName: true, lastName: true }
      });
      
      if (firstContact) {
        const startTime5 = Date.now();
        const messages = await prisma.telnyxMessage.findMany({
          where: {
            contactId: firstContact.id
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 50,
        });
        const endTime5 = Date.now();
        console.log(`✅ Messages for ${firstContact.firstName} ${firstContact.lastName}: ${messages.length}`);
        console.log(`⏱️  Query time: ${endTime5 - startTime5}ms\n`);
      }
    }

    // Test 6: Activities for contact
    if (totalContacts > 0) {
      console.log('📊 Test 6: Activities Query');
      const startTime6 = Date.now();
      const activities = await prisma.activity.findMany({
        where: {
          status: 'planned'
        },
        orderBy: {
          due_date: 'asc'
        },
        take: 20,
      });
      const endTime6 = Date.now();
      console.log(`✅ Planned activities: ${activities.length}`);
      console.log(`⏱️  Query time: ${endTime6 - startTime6}ms\n`);
    }

    // Test 7: Dashboard stats (multiple aggregations)
    console.log('📊 Test 7: Dashboard Statistics');
    const startTime7 = Date.now();
    const [
      totalContactsCount,
      recentContactsCount,
      totalActivitiesCount,
      pendingActivitiesCount
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.activity.count(),
      prisma.activity.count({
        where: {
          status: 'planned'
        }
      })
    ]);
    const endTime7 = Date.now();
    console.log(`✅ Dashboard stats calculated:`);
    console.log(`   - Total contacts: ${totalContactsCount}`);
    console.log(`   - Recent contacts: ${recentContactsCount}`);
    console.log(`   - Total activities: ${totalActivitiesCount}`);
    console.log(`   - Pending activities: ${pendingActivitiesCount}`);
    console.log(`⏱️  Query time: ${endTime7 - startTime7}ms\n`);

    // Test 8: Complex join query (contacts with assignments)
    console.log('📊 Test 8: Complex Join Query (Contacts with Assignments)');
    const startTime8 = Date.now();
    const assignedContacts = await prisma.contact.findMany({
      where: {
        assignments: {
          some: {}
        }
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      take: 20,
      orderBy: {
        createdAt: 'desc'
      }
    });
    const endTime8 = Date.now();
    console.log(`✅ Assigned contacts: ${assignedContacts.length}`);
    console.log(`⏱️  Query time: ${endTime8 - startTime8}ms\n`);

    console.log('🎉 Performance tests completed successfully!');
    console.log('\n📈 Performance Summary:');
    console.log('- All queries should complete under 500ms for good performance');
    console.log('- Queries over 1000ms indicate potential optimization needs');
    console.log('- With proper indexing, most queries should be under 100ms');

  } catch (error) {
    console.error('❌ Error during performance testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the performance test
testPerformance().catch(console.error);

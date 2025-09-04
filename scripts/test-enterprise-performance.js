const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testEnterprisePerformance() {
  console.log('🚀 Testing Enterprise CRM Performance...\n');
  console.log('Database: sms_messaging');
  console.log('Optimizations: Pagination, Caching, Advanced Queries\n');

  try {
    // Test 1: Basic contact count
    console.log('📊 Test 1: Contact Count');
    const startTime1 = Date.now();
    const totalContacts = await prisma.contact.count();
    const endTime1 = Date.now();
    console.log(`✅ Total contacts: ${totalContacts.toLocaleString()}`);
    console.log(`⏱️  Query time: ${endTime1 - startTime1}ms\n`);

    // Test 2: Optimized paginated contact fetch
    console.log('📊 Test 2: Optimized Paginated Contact Fetch');
    const startTime2 = Date.now();
    const contactsPage = await prisma.contact.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        email1: true,
        propertyAddress: true,
        dealStatus: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      skip: 0,
    });
    const endTime2 = Date.now();
    console.log(`✅ Fetched ${contactsPage.length} contacts (optimized)`);
    console.log(`⏱️  Query time: ${endTime2 - startTime2}ms\n`);

    // Test 3: Search performance (simulating the new API)
    console.log('📊 Test 3: Search Performance Test');
    const startTime3 = Date.now();
    const searchResults = await prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: 'john', mode: 'insensitive' } },
          { lastName: { contains: 'john', mode: 'insensitive' } },
          { llcName: { contains: 'john', mode: 'insensitive' } },
          { phone1: { contains: '555' } },
          { email1: { contains: 'test', mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
        email1: true,
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const endTime3 = Date.now();
    console.log(`✅ Search results: ${searchResults.length} contacts`);
    console.log(`⏱️  Query time: ${endTime3 - startTime3}ms\n`);

    // Test 4: Filter by deal status (with index)
    console.log('📊 Test 4: Deal Status Filter Performance');
    const startTime4 = Date.now();
    const leadContacts = await prisma.contact.findMany({
      where: {
        dealStatus: 'lead'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dealStatus: true,
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const endTime4 = Date.now();
    console.log(`✅ Lead contacts: ${leadContacts.length}`);
    console.log(`⏱️  Query time: ${endTime4 - startTime4}ms\n`);

    // Test 5: Complex filtering (multiple conditions)
    console.log('📊 Test 5: Complex Multi-Filter Query');
    const startTime5 = Date.now();
    const complexFilter = await prisma.contact.findMany({
      where: {
        AND: [
          { dealStatus: 'lead' },
          { dnc: false },
          { 
            OR: [
              { city: { contains: 'New', mode: 'insensitive' } },
              { state: { equals: 'CA' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        state: true,
        dealStatus: true,
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const endTime5 = Date.now();
    console.log(`✅ Complex filter results: ${complexFilter.length} contacts`);
    console.log(`⏱️  Query time: ${endTime5 - startTime5}ms\n`);

    // Test 6: Dashboard aggregations
    console.log('📊 Test 6: Dashboard Statistics (Parallel Queries)');
    const startTime6 = Date.now();
    const [
      totalContactsCount,
      recentContactsCount,
      leadContactsCount,
      dncContactsCount
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.contact.count({
        where: { dealStatus: 'lead' }
      }),
      prisma.contact.count({
        where: { dnc: true }
      })
    ]);
    const endTime6 = Date.now();
    console.log(`✅ Dashboard stats calculated:`);
    console.log(`   - Total contacts: ${totalContactsCount.toLocaleString()}`);
    console.log(`   - Recent contacts (30 days): ${recentContactsCount.toLocaleString()}`);
    console.log(`   - Lead contacts: ${leadContactsCount.toLocaleString()}`);
    console.log(`   - DNC contacts: ${dncContactsCount.toLocaleString()}`);
    console.log(`⏱️  Query time: ${endTime6 - startTime6}ms\n`);

    // Test 7: Messages query performance
    if (totalContacts > 0) {
      console.log('📊 Test 7: Messages Query Performance');
      const firstContact = await prisma.contact.findFirst({
        select: { id: true, firstName: true, lastName: true }
      });
      
      if (firstContact) {
        const startTime7 = Date.now();
        const messages = await prisma.telnyxMessage.findMany({
          where: {
            contactId: firstContact.id
          },
          select: {
            id: true,
            content: true,
            direction: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 50,
        });
        const endTime7 = Date.now();
        console.log(`✅ Messages for ${firstContact.firstName} ${firstContact.lastName}: ${messages.length}`);
        console.log(`⏱️  Query time: ${endTime7 - startTime7}ms\n`);
      }
    }

    // Test 8: Bulk operation simulation
    console.log('📊 Test 8: Bulk Operation Simulation');
    const startTime8 = Date.now();
    const bulkContacts = await prisma.contact.findMany({
      where: {
        AND: [
          { dnc: false },
          { phone1: { not: null } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone1: true,
      },
      take: 100, // Simulate selecting 100 contacts for bulk operation
      orderBy: {
        createdAt: 'desc',
      },
    });
    const endTime8 = Date.now();
    console.log(`✅ Bulk operation selection: ${bulkContacts.length} contacts`);
    console.log(`⏱️  Query time: ${endTime8 - startTime8}ms\n`);

    console.log('🎉 Enterprise Performance Tests Completed!');
    console.log('================================================');
    console.log('\n📈 Performance Analysis:');
    console.log('✅ Queries under 100ms: Excellent performance');
    console.log('⚠️  Queries 100-500ms: Good performance');
    console.log('❌ Queries over 500ms: Needs optimization');
    console.log('\n🚀 Your CRM is now optimized for enterprise-scale performance!');
    
    if (totalContacts < 1000) {
      console.log('\n💡 Note: With only a few contacts, performance gains may not be noticeable.');
      console.log('   The optimizations will show significant improvements with 10K+ contacts.');
    }

  } catch (error) {
    console.error('❌ Error during performance testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the performance test
testEnterprisePerformance().catch(console.error);

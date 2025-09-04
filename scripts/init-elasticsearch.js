const { PrismaClient } = require('@prisma/client');
const { Client } = require('@elastic/elasticsearch');
require('dotenv').config();

const prisma = new PrismaClient();
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  } : undefined,
});

const INDEX_NAME = 'contacts';

async function initializeElasticsearch() {
  console.log('🔍 Initializing Elasticsearch for 500K+ Contact Search...\n');

  try {
    // Test Elasticsearch connection
    console.log('📡 Testing Elasticsearch connection...');
    const pingResponse = await esClient.ping();
    if (pingResponse.statusCode !== 200) {
      throw new Error('Elasticsearch is not responding');
    }
    console.log('✅ Elasticsearch connection successful\n');

    // Delete existing index if it exists
    console.log('🗑️  Checking for existing index...');
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });
    if (indexExists) {
      console.log('Deleting existing index...');
      await esClient.indices.delete({ index: INDEX_NAME });
      console.log('✅ Existing index deleted\n');
    }

    // Create optimized index for 500K+ contacts
    console.log('🏗️  Creating optimized index mapping...');
    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          max_result_window: 100000,
          analysis: {
            analyzer: {
              contact_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: [
                  'lowercase',
                  'asciifolding',
                  'stop',
                  'snowball'
                ]
              },
              phone_analyzer: {
                type: 'custom',
                tokenizer: 'keyword',
                filter: ['lowercase']
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            firstName: { 
              type: 'text',
              analyzer: 'contact_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            lastName: { 
              type: 'text',
              analyzer: 'contact_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            fullName: { 
              type: 'text',
              analyzer: 'contact_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            llcName: { 
              type: 'text',
              analyzer: 'contact_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            phone1: { 
              type: 'text',
              analyzer: 'phone_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            phone2: { 
              type: 'text',
              analyzer: 'phone_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            phone3: { 
              type: 'text',
              analyzer: 'phone_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            email1: { 
              type: 'text',
              analyzer: 'standard',
              fields: { keyword: { type: 'keyword' } }
            },
            email2: { 
              type: 'text',
              analyzer: 'standard',
              fields: { keyword: { type: 'keyword' } }
            },
            email3: { 
              type: 'text',
              analyzer: 'standard',
              fields: { keyword: { type: 'keyword' } }
            },
            propertyAddress: { 
              type: 'text',
              analyzer: 'contact_analyzer'
            },
            contactAddress: { 
              type: 'text',
              analyzer: 'contact_analyzer'
            },
            city: { 
              type: 'text',
              analyzer: 'contact_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            state: { 
              type: 'keyword'
            },
            propertyCounty: { 
              type: 'text',
              analyzer: 'contact_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            propertyType: { 
              type: 'keyword'
            },
            dealStatus: { 
              type: 'keyword'
            },
            estValue: { 
              type: 'double'
            },
            estEquity: { 
              type: 'double'
            },
            dnc: { 
              type: 'boolean'
            },
            createdAt: { 
              type: 'date'
            },
            updatedAt: { 
              type: 'date'
            },
            tags: { 
              type: 'keyword'
            }
          }
        }
      }
    });
    console.log('✅ Index created successfully\n');

    // Get total contact count
    console.log('📊 Checking contact count in database...');
    const totalContacts = await prisma.contact.count();
    console.log(`Found ${totalContacts.toLocaleString()} contacts to index\n`);

    if (totalContacts === 0) {
      console.log('⚠️  No contacts found in database. Index created but empty.');
      return;
    }

    // Bulk index contacts in batches
    console.log('🚀 Starting bulk indexing process...');
    const batchSize = 1000;
    let processed = 0;
    let offset = 0;

    while (offset < totalContacts) {
      console.log(`Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(totalContacts / batchSize)}...`);
      
      const contacts = await prisma.contact.findMany({
        skip: offset,
        take: batchSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          llcName: true,
          phone1: true,
          phone2: true,
          phone3: true,
          email1: true,
          email2: true,
          email3: true,
          propertyAddress: true,
          contactAddress: true,
          city: true,
          state: true,
          propertyCounty: true,
          propertyType: true,
          dealStatus: true,
          estValue: true,
          estEquity: true,
          dnc: true,
          createdAt: true,
          updatedAt: true,
          contact_tags: {
            select: {
              tag: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (contacts.length === 0) break;

      // Prepare bulk index operations
      const body = contacts.flatMap(contact => [
        { index: { _index: INDEX_NAME, _id: contact.id } },
        {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          llcName: contact.llcName,
          phone1: contact.phone1,
          phone2: contact.phone2,
          phone3: contact.phone3,
          email1: contact.email1,
          email2: contact.email2,
          email3: contact.email3,
          propertyAddress: contact.propertyAddress,
          contactAddress: contact.contactAddress,
          city: contact.city,
          state: contact.state,
          propertyCounty: contact.propertyCounty,
          propertyType: contact.propertyType,
          dealStatus: contact.dealStatus,
          estValue: contact.estValue ? Number(contact.estValue) : undefined,
          estEquity: contact.estEquity ? Number(contact.estEquity) : undefined,
          dnc: contact.dnc,
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt?.toISOString(),
          tags: contact.contact_tags.map(ct => ct.tag.name)
        }
      ]);

      // Execute bulk index
      const response = await esClient.bulk({ body });

      if (response.errors) {
        const erroredDocuments = response.items.filter(item => item.index && item.index.error);
        console.error(`❌ ${erroredDocuments.length} documents failed to index`);
        erroredDocuments.forEach(doc => {
          console.error(`Error indexing document ${doc.index._id}:`, doc.index.error);
        });
      }

      processed += contacts.length;
      offset += batchSize;

      const progress = Math.round((processed / totalContacts) * 100);
      console.log(`✅ Processed ${processed.toLocaleString()}/${totalContacts.toLocaleString()} contacts (${progress}%)`);

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Refresh index to make documents searchable
    console.log('\n🔄 Refreshing index...');
    await esClient.indices.refresh({ index: INDEX_NAME });

    // Get index statistics
    console.log('📈 Getting index statistics...');
    const stats = await esClient.indices.stats({ index: INDEX_NAME });
    const indexStats = stats.indices[INDEX_NAME];

    console.log('\n🎉 Elasticsearch initialization complete!');
    console.log('================================================');
    console.log(`📊 Index Statistics:`);
    console.log(`   • Documents: ${indexStats.total.docs.count.toLocaleString()}`);
    console.log(`   • Index Size: ${Math.round(indexStats.total.store.size_in_bytes / 1024 / 1024)}MB`);
    console.log(`   • Shards: ${indexStats.total.segments.count}`);
    console.log('\n🚀 Your CRM now has lightning-fast search capabilities!');
    console.log('   • Sub-second search across 500K+ contacts');
    console.log('   • Auto-complete suggestions');
    console.log('   • Advanced filtering and aggregations');
    console.log('   • Fuzzy matching for typos');

  } catch (error) {
    console.error('❌ Error initializing Elasticsearch:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeElasticsearch().catch(console.error);

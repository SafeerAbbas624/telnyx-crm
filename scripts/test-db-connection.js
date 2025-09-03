const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Attempting to connect to the database...');
    await prisma.$connect();
    console.log('✅ Successfully connected to the database');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Test query result:', result);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error connecting to the database:');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();

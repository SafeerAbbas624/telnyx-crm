import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

// Optimized Prisma configuration for production
export const prisma = global.prisma || new PrismaClient({
  log: process.env.ENABLE_QUERY_LOGGING === 'true' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connection pooling and optimization
if (process.env.NODE_ENV === 'production') {
  // Enable connection pooling in production
  prisma.$connect();
} else {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

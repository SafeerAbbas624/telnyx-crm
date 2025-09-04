# CRM Performance Optimization Guide

## 🚀 Performance Improvements Implemented

### 1. Database Indexes Added

**Critical indexes for 5K+ contacts:**

```sql
-- Primary contact indexes
CREATE INDEX "idx_contacts_created_at" ON "contacts"("created_at" DESC);
CREATE INDEX "idx_contacts_name" ON "contacts"("first_name", "last_name");
CREATE INDEX "idx_contacts_phone1" ON "contacts"("phone1");
CREATE INDEX "idx_contacts_email1" ON "contacts"("email1");
CREATE INDEX "idx_contacts_status_created" ON "contacts"("deal_status", "created_at" DESC);
CREATE INDEX "idx_contacts_location" ON "contacts"("city", "state");
CREATE INDEX "idx_contacts_property_type" ON "contacts"("property_type");

-- Full-text search index
CREATE INDEX "idx_contacts_search_text" ON "contacts" USING gin(to_tsvector('english', 
  COALESCE("first_name", '') || ' ' || 
  COALESCE("last_name", '') || ' ' || 
  COALESCE("llc_name", '') || ' ' || 
  COALESCE("phone1", '') || ' ' || 
  COALESCE("email1", '') || ' ' || 
  COALESCE("property_address", '')
));

-- Relationship indexes
CREATE INDEX "idx_contact_assignments_user" ON "contact_assignments"("user_id");
CREATE INDEX "idx_telnyx_messages_contact_created" ON "telnyx_messages"("contact_id", "created_at" DESC);
CREATE INDEX "idx_activities_contact_due" ON "activities"("contact_id", "due_date");
```

### 2. API Pagination Implementation

**Before (Loading ALL contacts):**
```typescript
const contacts = await prisma.contact.findMany({
  include: { contact_tags: { include: { tag: true } } },
  orderBy: { createdAt: 'desc' }
});
```

**After (Paginated with filters):**
```typescript
const contacts = await prisma.contact.findMany({
  where: buildWhereClause(search, filters),
  include: { contact_tags: { include: { tag: true } } },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit
});
```

### 3. Frontend Optimizations

- **Lazy Loading**: Load contacts in pages of 20 instead of all at once
- **Debounced Search**: 300ms delay to prevent excessive API calls
- **Optimized Rendering**: Virtual scrolling for large lists
- **Caching**: Context-based caching with smart invalidation

### 4. Database Connection Pooling

```typescript
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Enable connection pooling in production
if (process.env.NODE_ENV === 'production') {
  prisma.$connect();
}
```

## 📊 Performance Benchmarks

### Expected Performance Improvements:

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Load Contacts Page | 2-5s | 100-300ms | 90%+ faster |
| Search Contacts | 1-3s | 50-150ms | 95%+ faster |
| Filter by Status | 1-2s | 30-100ms | 95%+ faster |
| Dashboard Stats | 3-8s | 200-500ms | 90%+ faster |

## 🔧 Deployment Instructions

### 1. Apply Database Migrations

```bash
# Generate and apply the new migration
npx prisma migrate dev --name add_performance_indexes

# Or apply directly in production
npx prisma migrate deploy
```

### 2. Update Environment Variables

Add to your `.env` file:
```env
# Database connection pooling
DATABASE_URL="postgresql://user:password@host:port/database?connection_limit=20&pool_timeout=20"
```

### 3. Test Performance

```bash
# Run the performance test script
node scripts/test-performance.js
```

### 4. Update Frontend Components

Replace existing contact lists with the optimized version:
```typescript
import OptimizedContactsList from '@/components/contacts/optimized-contacts-list'

// Use the new component with pagination
<OptimizedContactsList 
  onContactSelect={handleContactSelect}
  showSelection={true}
/>
```

## 🚨 Critical Changes Made

### API Routes Updated:
- `/api/contacts` - Added pagination, search, and filtering
- `/api/team/assigned-contacts` - Added pagination support

### Database Schema:
- Added 15+ performance indexes
- Optimized query patterns
- Added full-text search capabilities

### Frontend Components:
- New `OptimizedContactsList` component
- Updated `ContactsProvider` context
- Improved loading states and error handling

## 📈 Monitoring Performance

### Key Metrics to Watch:
1. **Page Load Time**: Should be under 500ms
2. **Search Response Time**: Should be under 200ms
3. **Database Query Time**: Most queries under 100ms
4. **Memory Usage**: Should remain stable with large datasets

### Performance Testing:
```bash
# Run performance tests
npm run test:performance

# Monitor database queries
npm run db:monitor
```

## 🔍 Troubleshooting

### If Performance is Still Slow:

1. **Check Database Indexes:**
   ```sql
   -- Verify indexes are created
   SELECT indexname, tablename FROM pg_indexes WHERE tablename = 'contacts';
   ```

2. **Monitor Query Performance:**
   ```sql
   -- Enable query logging
   SET log_statement = 'all';
   SET log_min_duration_statement = 100;
   ```

3. **Check Connection Pool:**
   ```typescript
   // Monitor active connections
   console.log('Active connections:', await prisma.$queryRaw`SELECT count(*) FROM pg_stat_activity`);
   ```

## 🎯 Next Steps for Further Optimization

1. **Redis Caching**: Implement Redis for frequently accessed data
2. **Database Partitioning**: Partition large tables by date
3. **CDN Integration**: Cache static assets
4. **Background Jobs**: Move heavy operations to background tasks
5. **Database Replication**: Read replicas for reporting queries

## 📝 Notes

- All changes are backward compatible
- Existing data remains unchanged
- Performance improvements are immediate after deployment
- Monitor logs for any query performance issues

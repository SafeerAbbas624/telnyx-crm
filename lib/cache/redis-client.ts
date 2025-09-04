import Redis from 'ioredis'

// Redis client configuration for enterprise-scale caching
class RedisClient {
  private client: Redis
  private isConnected: boolean = false

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      // Connection pool settings for high load
      family: 4,
      connectTimeout: 10000,
      commandTimeout: 5000,
    })

    this.client.on('connect', () => {
      console.log('✅ Redis connected')
      this.isConnected = true
    })

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err)
      this.isConnected = false
    })

    this.client.on('close', () => {
      console.log('🔌 Redis connection closed')
      this.isConnected = false
    })
  }

  async connect() {
    // Temporarily disabled for debugging
    return
    // if (!this.isConnected) {
    //   await this.client.connect()
    // }
  }

  // Cache keys for different data types
  private getContactsKey(page: number, limit: number, filters: string) {
    return `contacts:page:${page}:limit:${limit}:filters:${filters}`
  }

  private getContactKey(id: string) {
    return `contact:${id}`
  }

  private getSearchKey(query: string, page: number, limit: number) {
    return `search:${query}:page:${page}:limit:${limit}`
  }

  private getStatsKey(type: string) {
    return `stats:${type}`
  }

  private getConversationKey(contactId: string) {
    return `conversation:${contactId}`
  }

  // Contact caching methods
  async cacheContacts(key: string, contacts: any[], ttl: number = 300) {
    try {
      await this.connect()
      await this.client.setex(key, ttl, JSON.stringify(contacts))
    } catch (error) {
      console.error('Error caching contacts:', error)
    }
  }

  async getCachedContacts(key: string): Promise<any[] | null> {
    try {
      await this.connect()
      const cached = await this.client.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Error getting cached contacts:', error)
      return null
    }
  }

  // Paginated contacts with filters
  async cacheContactsPage(page: number, limit: number, filters: any, contacts: any[], pagination: any) {
    const filtersKey = JSON.stringify(filters)
    const key = this.getContactsKey(page, limit, filtersKey)
    const data = { contacts, pagination }
    await this.cacheContacts(key, data, 180) // 3 minutes cache
  }

  async getCachedContactsPage(page: number, limit: number, filters: any) {
    const filtersKey = JSON.stringify(filters)
    const key = this.getContactsKey(page, limit, filtersKey)
    return await this.getCachedContacts(key)
  }

  // Individual contact caching
  async cacheContact(contact: any, ttl: number = 600) {
    const key = this.getContactKey(contact.id)
    try {
      await this.connect()
      await this.client.setex(key, ttl, JSON.stringify(contact))
    } catch (error) {
      console.error('Error caching contact:', error)
    }
  }

  async getCachedContact(id: string): Promise<any | null> {
    const key = this.getContactKey(id)
    return await this.getCachedContacts(key)
  }

  // Search results caching
  async cacheSearchResults(query: string, page: number, limit: number, results: any[], ttl: number = 120) {
    const key = this.getSearchKey(query, page, limit)
    await this.cacheContacts(key, results, ttl)
  }

  async getCachedSearchResults(query: string, page: number, limit: number) {
    const key = this.getSearchKey(query, page, limit)
    return await this.getCachedContacts(key)
  }

  // Dashboard stats caching
  async cacheStats(type: string, stats: any, ttl: number = 900) {
    const key = this.getStatsKey(type)
    try {
      await this.connect()
      await this.client.setex(key, ttl, JSON.stringify(stats))
    } catch (error) {
      console.error('Error caching stats:', error)
    }
  }

  async getCachedStats(type: string): Promise<any | null> {
    const key = this.getStatsKey(type)
    return await this.getCachedContacts(key)
  }

  // Conversation caching
  async cacheConversation(contactId: string, messages: any[], ttl: number = 300) {
    const key = this.getConversationKey(contactId)
    await this.cacheContacts(key, messages, ttl)
  }

  async getCachedConversation(contactId: string) {
    const key = this.getConversationKey(contactId)
    return await this.getCachedContacts(key)
  }

  // Cache invalidation methods
  async invalidateContactCache(contactId: string) {
    try {
      await this.connect()
      const contactKey = this.getContactKey(contactId)
      await this.client.del(contactKey)
      
      // Also invalidate related caches
      const conversationKey = this.getConversationKey(contactId)
      await this.client.del(conversationKey)
      
      // Invalidate contacts list cache (pattern-based deletion)
      const pattern = 'contacts:page:*'
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (error) {
      console.error('Error invalidating contact cache:', error)
    }
  }

  async invalidateSearchCache() {
    try {
      await this.connect()
      const pattern = 'search:*'
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (error) {
      console.error('Error invalidating search cache:', error)
    }
  }

  async invalidateStatsCache() {
    try {
      await this.connect()
      const pattern = 'stats:*'
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } catch (error) {
      console.error('Error invalidating stats cache:', error)
    }
  }

  // Bulk operations for better performance
  async cacheBulkContacts(contacts: any[]) {
    try {
      await this.connect()
      const pipeline = this.client.pipeline()
      
      contacts.forEach(contact => {
        const key = this.getContactKey(contact.id)
        pipeline.setex(key, 600, JSON.stringify(contact))
      })
      
      await pipeline.exec()
    } catch (error) {
      console.error('Error bulk caching contacts:', error)
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.connect()
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      return false
    }
  }

  // Cleanup and disconnect
  async disconnect() {
    await this.client.quit()
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      await this.connect()
      const info = await this.client.info('memory')
      const keyspace = await this.client.info('keyspace')
      return { memory: info, keyspace }
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return null
    }
  }
}

// Singleton instance
export const redisClient = new RedisClient()

// Helper function to generate cache keys
export const generateCacheKey = (prefix: string, ...parts: (string | number)[]) => {
  return `${prefix}:${parts.join(':')}`
}

// Cache TTL constants
export const CACHE_TTL = {
  CONTACTS_LIST: 180,    // 3 minutes
  CONTACT_DETAIL: 600,   // 10 minutes
  SEARCH_RESULTS: 120,   // 2 minutes
  DASHBOARD_STATS: 900,  // 15 minutes
  CONVERSATION: 300,     // 5 minutes
  USER_SESSION: 3600,    // 1 hour
} as const

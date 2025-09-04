import Bull from 'bull'
import { redisClient } from '@/lib/cache/redis-client'
import { elasticsearchClient } from '@/lib/search/elasticsearch-client'
import { prisma } from '@/lib/db'

// Job types for enterprise operations
export enum JobType {
  BULK_CONTACT_IMPORT = 'bulk_contact_import',
  ELASTICSEARCH_SYNC = 'elasticsearch_sync',
  CONTACT_EXPORT = 'contact_export',
  BULK_EMAIL_SEND = 'bulk_email_send',
  BULK_SMS_SEND = 'bulk_sms_send',
  DATA_CLEANUP = 'data_cleanup',
  ANALYTICS_CALCULATION = 'analytics_calculation',
  BACKUP_CREATION = 'backup_creation'
}

// Queue configuration for different job types
const queueConfigs = {
  [JobType.BULK_CONTACT_IMPORT]: {
    concurrency: 2,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  },
  [JobType.ELASTICSEARCH_SYNC]: {
    concurrency: 1,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 }
  },
  [JobType.CONTACT_EXPORT]: {
    concurrency: 3,
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 }
  },
  [JobType.BULK_EMAIL_SEND]: {
    concurrency: 5,
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 }
  },
  [JobType.BULK_SMS_SEND]: {
    concurrency: 10,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  },
  [JobType.DATA_CLEANUP]: {
    concurrency: 1,
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 }
  },
  [JobType.ANALYTICS_CALCULATION]: {
    concurrency: 2,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  },
  [JobType.BACKUP_CREATION]: {
    concurrency: 1,
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 }
  }
}

class QueueManager {
  private queues: Map<JobType, Bull.Queue> = new Map()
  private isInitialized = false

  async initialize() {
    if (this.isInitialized) return

    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '1'), // Use different DB for jobs
    }

    // Create queues for each job type
    for (const [jobType, config] of Object.entries(queueConfigs)) {
      const queue = new Bull(jobType, {
        redis: redisConfig,
        defaultJobOptions: {
          attempts: config.attempts,
          backoff: config.backoff,
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50, // Keep last 50 failed jobs
        }
      })

      // Set up job processors
      queue.process(config.concurrency, this.getJobProcessor(jobType as JobType))

      // Set up event listeners
      this.setupQueueEvents(queue, jobType as JobType)

      this.queues.set(jobType as JobType, queue)
    }

    this.isInitialized = true
    console.log('✅ Queue Manager initialized')
  }

  private getJobProcessor(jobType: JobType) {
    return async (job: Bull.Job) => {
      console.log(`🔄 Processing job ${jobType}:${job.id}`)
      
      try {
        switch (jobType) {
          case JobType.BULK_CONTACT_IMPORT:
            return await this.processBulkContactImport(job)
          case JobType.ELASTICSEARCH_SYNC:
            return await this.processElasticsearchSync(job)
          case JobType.CONTACT_EXPORT:
            return await this.processContactExport(job)
          case JobType.BULK_EMAIL_SEND:
            return await this.processBulkEmailSend(job)
          case JobType.BULK_SMS_SEND:
            return await this.processBulkSmsSend(job)
          case JobType.DATA_CLEANUP:
            return await this.processDataCleanup(job)
          case JobType.ANALYTICS_CALCULATION:
            return await this.processAnalyticsCalculation(job)
          case JobType.BACKUP_CREATION:
            return await this.processBackupCreation(job)
          default:
            throw new Error(`Unknown job type: ${jobType}`)
        }
      } catch (error) {
        console.error(`❌ Job ${jobType}:${job.id} failed:`, error)
        throw error
      }
    }
  }

  private setupQueueEvents(queue: Bull.Queue, jobType: JobType) {
    queue.on('completed', (job) => {
      console.log(`✅ Job ${jobType}:${job.id} completed`)
    })

    queue.on('failed', (job, err) => {
      console.error(`❌ Job ${jobType}:${job.id} failed:`, err.message)
    })

    queue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${jobType}:${job.id} stalled`)
    })
  }

  // Job Processors
  private async processBulkContactImport(job: Bull.Job) {
    const { contacts, userId, batchSize = 1000 } = job.data
    let processed = 0
    let errors = 0

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)
      
      try {
        // Insert batch into database
        const createdContacts = await prisma.contact.createMany({
          data: batch.map((contact: any) => ({
            ...contact,
            createdAt: new Date(),
            updatedAt: new Date()
          })),
          skipDuplicates: true
        })

        // Index in Elasticsearch
        if (await elasticsearchClient.isHealthy()) {
          await elasticsearchClient.bulkIndexContacts(batch)
        }

        processed += batch.length
        
        // Update job progress
        const progress = Math.round((processed / contacts.length) * 100)
        await job.progress(progress)

      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error)
        errors += batch.length
      }
    }

    // Invalidate caches
    await redisClient.invalidateSearchCache()
    await redisClient.invalidateStatsCache()

    return { processed, errors, total: contacts.length }
  }

  private async processElasticsearchSync(job: Bull.Job) {
    const { contactIds, operation = 'index' } = job.data
    let processed = 0

    if (operation === 'full_reindex') {
      // Full reindex of all contacts
      const batchSize = 1000
      let offset = 0
      let hasMore = true

      while (hasMore) {
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
        })

        if (contacts.length === 0) {
          hasMore = false
          break
        }

        // Transform and index
        const esContacts = contacts.map(contact => ({
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
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
        }))

        await elasticsearchClient.bulkIndexContacts(esContacts)
        
        processed += contacts.length
        offset += batchSize

        // Update progress
        const progress = Math.min(Math.round((processed / 500000) * 100), 99)
        await job.progress(progress)
      }
    } else {
      // Sync specific contacts
      for (const contactId of contactIds) {
        try {
          const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: {
              contact_tags: {
                include: { tag: true }
              }
            }
          })

          if (contact) {
            if (operation === 'delete') {
              await elasticsearchClient.deleteContact(contactId)
            } else {
              await elasticsearchClient.indexContact({
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
              })
            }
            processed++
          }
        } catch (error) {
          console.error(`Error syncing contact ${contactId}:`, error)
        }
      }
    }

    return { processed, operation }
  }

  private async processContactExport(job: Bull.Job) {
    const { filters, format = 'csv', userId } = job.data
    
    // This would implement contact export logic
    // For now, return a placeholder
    return { message: 'Export completed', format, recordCount: 0 }
  }

  private async processBulkEmailSend(job: Bull.Job) {
    const { contactIds, emailContent, userId } = job.data
    
    // This would implement bulk email sending
    // For now, return a placeholder
    return { sent: contactIds.length, failed: 0 }
  }

  private async processBulkSmsSend(job: Bull.Job) {
    const { contactIds, messageContent, userId } = job.data
    
    // This would implement bulk SMS sending
    // For now, return a placeholder
    return { sent: contactIds.length, failed: 0 }
  }

  private async processDataCleanup(job: Bull.Job) {
    const { type, olderThanDays = 90 } = job.data
    
    // This would implement data cleanup logic
    // For now, return a placeholder
    return { cleaned: 0, type }
  }

  private async processAnalyticsCalculation(job: Bull.Job) {
    const { type, dateRange } = job.data
    
    // This would implement analytics calculation
    // For now, return a placeholder
    return { calculated: true, type }
  }

  private async processBackupCreation(job: Bull.Job) {
    const { tables, destination } = job.data
    
    // This would implement backup creation
    // For now, return a placeholder
    return { backup: 'completed', destination }
  }

  // Public methods to add jobs
  async addJob(jobType: JobType, data: any, options: Bull.JobOptions = {}) {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const queue = this.queues.get(jobType)
    if (!queue) {
      throw new Error(`Queue for job type ${jobType} not found`)
    }

    return await queue.add(data, options)
  }

  async getJobStatus(jobType: JobType, jobId: string) {
    const queue = this.queues.get(jobType)
    if (!queue) return null

    const job = await queue.getJob(jobId)
    if (!job) return null

    return {
      id: job.id,
      data: job.data,
      progress: job.progress(),
      state: await job.getState(),
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason
    }
  }

  async getQueueStats(jobType: JobType) {
    const queue = this.queues.get(jobType)
    if (!queue) return null

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed()
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    }
  }

  async shutdown() {
    for (const queue of this.queues.values()) {
      await queue.close()
    }
    console.log('✅ Queue Manager shutdown complete')
  }
}

export const queueManager = new QueueManager()

import Queue from 'bull'
import { redisPublisher } from '@/lib/redis'

// Email sync job data interface
export interface EmailSyncJob {
  accountId?: string // If specified, sync only this account
  userId?: string // User who triggered the sync
  type: 'manual' | 'auto' | 'initial' // Type of sync
}

// Create Bull queue for email syncing
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
}

// Singleton pattern for queue
const g: any = globalThis as any

if (!g.__EMAIL_SYNC_QUEUE__) {
  g.__EMAIL_SYNC_QUEUE__ = new Queue<EmailSyncJob>('email-sync', {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 second delay
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 200, // Keep last 200 failed jobs
    },
  })

  // Log queue events
  g.__EMAIL_SYNC_QUEUE__.on('completed', (job: any) => {
    console.log(`✅ Email sync job ${job.id} completed`)
  })

  g.__EMAIL_SYNC_QUEUE__.on('failed', (job: any, err: Error) => {
    console.error(`❌ Email sync job ${job.id} failed:`, err.message)
  })

  g.__EMAIL_SYNC_QUEUE__.on('stalled', (job: any) => {
    console.warn(`⚠️ Email sync job ${job.id} stalled`)
  })
}

export const emailSyncQueue: Queue<EmailSyncJob> = g.__EMAIL_SYNC_QUEUE__

// Helper function to add sync job to queue
export async function queueEmailSync(data: EmailSyncJob) {
  try {
    const job = await emailSyncQueue.add(data, {
      priority: data.type === 'manual' ? 1 : 10, // Manual syncs have higher priority
      jobId: data.accountId ? `sync-${data.accountId}-${Date.now()}` : `sync-all-${Date.now()}`,
    })
    
    console.log(`📬 Queued email sync job ${job.id}`, data)
    return job
  } catch (error) {
    console.error('Failed to queue email sync:', error)
    throw error
  }
}

// Helper function to get queue stats
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailSyncQueue.getWaitingCount(),
    emailSyncQueue.getActiveCount(),
    emailSyncQueue.getCompletedCount(),
    emailSyncQueue.getFailedCount(),
    emailSyncQueue.getDelayedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  }
}

// Helper function to clear completed jobs
export async function clearCompletedJobs() {
  await emailSyncQueue.clean(0, 'completed')
  console.log('🧹 Cleared completed email sync jobs')
}

// Helper function to clear failed jobs
export async function clearFailedJobs() {
  await emailSyncQueue.clean(0, 'failed')
  console.log('🧹 Cleared failed email sync jobs')
}


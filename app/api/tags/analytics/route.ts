import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/tags/analytics - Get comprehensive tag analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30' // days
    const includeSystem = searchParams.get('includeSystem') !== 'false'

    const daysAgo = parseInt(timeframe)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    // Get tag usage statistics
    const tagUsage = await prisma.tag.findMany({
      where: includeSystem ? {} : { is_system: false },
      include: {
        _count: {
          select: { 
            contact_tags: {
              where: {
                created_at: { gte: startDate }
              }
            }
          }
        },
        contact_tags: {
          where: {
            created_at: { gte: startDate }
          },
          select: {
            created_at: true,
            contact: {
              select: {
                dealStatus: true
              }
            }
          }
        }
      },
      orderBy: {
        contact_tags: {
          _count: 'desc'
        }
      }
    })

    // Calculate analytics
    const analytics = {
      summary: {
        total_tags: tagUsage.length,
        total_applications: tagUsage.reduce((sum, tag) => sum + tag._count.contact_tags, 0),
        most_used_tag: tagUsage[0] ? {
          name: tagUsage[0].name,
          color: tagUsage[0].color,
          usage_count: tagUsage[0]._count.contact_tags
        } : null,
        unused_tags: tagUsage.filter(tag => tag._count.contact_tags === 0).length
      },
      top_tags: tagUsage.slice(0, 10).map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        usage_count: tag._count.contact_tags,
        is_system: tag.is_system,
        deal_status_breakdown: tag.contact_tags.reduce((acc: any, ct) => {
          const status = ct.contact.dealStatus || 'unknown'
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {})
      })),
      usage_trends: await getUsageTrends(daysAgo, includeSystem),
      tag_combinations: await getTagCombinations(includeSystem),
      performance_metrics: await getPerformanceMetrics(includeSystem)
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error fetching tag analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tag analytics' },
      { status: 500 }
    )
  }
}

// Helper function to get usage trends over time
async function getUsageTrends(days: number, includeSystem: boolean) {
  const trends = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const startOfDay = new Date(date.setHours(0, 0, 0, 0))
    const endOfDay = new Date(date.setHours(23, 59, 59, 999))

    const dailyUsage = await prisma.contactTag.count({
      where: {
        created_at: {
          gte: startOfDay,
          lte: endOfDay
        },
        ...(includeSystem ? {} : {
          tag: { is_system: false }
        })
      }
    })

    trends.push({
      date: startOfDay.toISOString().split('T')[0],
      applications: dailyUsage
    })
  }

  return trends
}

// Helper function to get common tag combinations
async function getTagCombinations(includeSystem: boolean) {
  // Get contacts with multiple tags
  const contactsWithTags = await prisma.contact.findMany({
    where: {
      contact_tags: {
        some: includeSystem ? {} : {
          tag: { is_system: false }
        }
      }
    },
    include: {
      contact_tags: {
        where: includeSystem ? {} : {
          tag: { is_system: false }
        },
        include: {
          tag: {
            select: { name: true, color: true }
          }
        }
      }
    }
  })

  // Count tag combinations
  const combinations: { [key: string]: { count: number; tags: string[] } } = {}

  contactsWithTags.forEach(contact => {
    if (contact.contact_tags.length > 1) {
      const tagNames = contact.contact_tags
        .map(ct => ct.tag.name)
        .sort()
      
      // Generate all pairs
      for (let i = 0; i < tagNames.length; i++) {
        for (let j = i + 1; j < tagNames.length; j++) {
          const key = `${tagNames[i]}|${tagNames[j]}`
          if (!combinations[key]) {
            combinations[key] = { count: 0, tags: [tagNames[i], tagNames[j]] }
          }
          combinations[key].count++
        }
      }
    }
  })

  // Return top 10 combinations
  return Object.values(combinations)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

// Helper function to get performance metrics
async function getPerformanceMetrics(includeSystem: boolean) {
  // Get conversion rates by tag (lead -> other statuses)
  const tagPerformance = await prisma.tag.findMany({
    where: includeSystem ? {} : { is_system: false },
    include: {
      contact_tags: {
        include: {
          contact: {
            select: {
              dealStatus: true,
              createdAt: true
            }
          }
        }
      }
    }
  })

  const performance = tagPerformance.map(tag => {
    const contacts = tag.contact_tags.map(ct => ct.contact)
    const totalContacts = contacts.length
    
    if (totalContacts === 0) {
      return {
        tag_name: tag.name,
        total_contacts: 0,
        conversion_rate: 0,
        avg_time_to_convert: null
      }
    }

    const converted = contacts.filter(c => c.dealStatus !== 'lead').length
    const conversionRate = (converted / totalContacts) * 100

    return {
      tag_name: tag.name,
      color: tag.color,
      total_contacts: totalContacts,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      status_breakdown: contacts.reduce((acc: any, contact) => {
        const status = contact.dealStatus || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})
    }
  })

  return performance
    .filter(p => p.total_contacts > 0)
    .sort((a, b) => b.conversion_rate - a.conversion_rate)
    .slice(0, 15)
}

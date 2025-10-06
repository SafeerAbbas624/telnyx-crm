import { Client } from '@elastic/elasticsearch'

interface ContactDocument {
  id: string
  firstName?: string
  lastName?: string
  fullName: string
  llcName?: string
  phone1?: string
  phone2?: string
  phone3?: string
  email1?: string
  email2?: string
  email3?: string
  propertyAddress?: string
  contactAddress?: string
  city?: string
  state?: string
  propertyCounty?: string
  propertyType?: string
  dealStatus?: string
  estValue?: number
  estEquity?: number
  dnc?: boolean
  createdAt: string
  updatedAt?: string
  tags?: string[]
}

class ElasticsearchClient {
  private client: Client
  private indexName = 'contacts'

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
        username: process.env.ELASTICSEARCH_USERNAME as string,
        password: process.env.ELASTICSEARCH_PASSWORD as string,
      } : undefined,
      maxRetries: 3,
      requestTimeout: 30000,
      // Disable sniffing in Docker single-node to avoid switching to
      // internal container addresses that the host cannot reach
      sniffOnStart: false,

    })
  }

  // Initialize index with optimized mapping for 500K+ contacts
  async initializeIndex() {
    const body = {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
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
          state: { type: 'keyword' },
          propertyCounty: {
            type: 'text',
            analyzer: 'contact_analyzer',
            fields: { keyword: { type: 'keyword' } }
          },
          propertyType: { type: 'keyword' },
          dealStatus: { type: 'keyword' },
          estValue: { type: 'double' },
          estEquity: { type: 'double' },
          dnc: { type: 'boolean' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          tags: { type: 'keyword' }
        }
      }
    }

    try {
      // Try to create index; if it already exists, ignore 400
      await (this.client.indices.create as any)({ index: this.indexName, body }, { ignore: [400], headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })
      console.log('✅ Elasticsearch index created (or already exists)')
    } catch (e: any) {
      const type = e?.meta?.body?.error?.type
      if (e?.meta?.statusCode === 400 && type === 'resource_already_exists_exception') {
        // Safe to ignore
        return
      }
      console.error('❌ Error creating Elasticsearch index:', e)
      throw e
    }
  }

  // Index a single contact
  async indexContact(contact: ContactDocument) {
    try {
      await this.client.index({
        index: this.indexName,
        id: contact.id,
        body: {
          ...contact,
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
        }
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })
    } catch (error) {
      console.error('Error indexing contact:', error)
      throw error
    }
  }

  // Bulk index contacts for initial data load
  async bulkIndexContacts(contacts: ContactDocument[]) {
    try {
      const body = contacts.flatMap(contact => [
        { index: { _index: this.indexName, _id: contact.id } },
        {
          ...contact,
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
        }
      ])

      const response = await this.client.bulk({
        body,
        refresh: true
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+x-ndjson; compatible-with=8' } })

      if (response.errors) {
        console.error('Bulk indexing errors:', response.items.filter(item => item.index?.error))
      }

      return response
    } catch (error) {
      console.error('Error bulk indexing contacts:', error)
      throw error
    }
  }

  // Advanced search with multiple criteria
  async searchContacts(query: {
    search?: string
    dealStatus?: string
    propertyType?: string
    city?: string
    state?: string
    minValue?: number
    maxValue?: number
    dnc?: boolean
    tags?: string[]
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) {
    const {
      search,
      dealStatus,
      propertyType,
      city,
      state,
      minValue,
      maxValue,
      dnc,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query

    const from = (page - 1) * limit

    // Build the query
    const must: any[] = []
    const filter: any[] = []

    // Full-text search across multiple fields
    if (search) {
      must.push({
        multi_match: {
          query: search,
          fields: [
            'fullName^3',
            'firstName^2',
            'lastName^2',
            'llcName^2',
            'phone1',
            'phone2',
            'phone3',
            'email1',
            'email2',
            'email3',
            'propertyAddress',
            'contactAddress',
            'tags^2'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or'
        }
      })
    }

    // Filters
    if (dealStatus) {
      filter.push({ term: { dealStatus } })
    }

    if (propertyType) {
      filter.push({ term: { propertyType } })
    }

    if (city) {
      filter.push({ term: { 'city.keyword': city } })
    }

    if (state) {
      filter.push({ term: { state } })
    }

    if (typeof dnc === 'boolean') {
      filter.push({ term: { dnc } })
    }

    // Value range filter
    if (minValue !== undefined || maxValue !== undefined) {
      const range: any = {}
      if (minValue !== undefined) range.gte = minValue
      if (maxValue !== undefined) range.lte = maxValue
      filter.push({ range: { estValue: range } })
    }

    // Tags filter
    if (tags && tags.length > 0) {
      filter.push({ terms: { tags } })
    }

    // Build sort
    const sort: any[] = []
    if (search) {
      sort.push({ _score: { order: 'desc' } })
    }
    sort.push({ [sortBy]: { order: sortOrder } })

    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              filter
            }
          },
          sort,
          from,
          size: limit,
          highlight: search ? {
            fields: {
              fullName: {},
              llcName: {},
              propertyAddress: {},
              email1: {}
            }
          } : undefined
        }
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })

      const hits = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
        _highlights: hit.highlight
      }))

      return {
        contacts: hits,
        total: response.hits.total?.value || 0,
        page,
        limit,
        totalPages: Math.ceil((response.hits.total?.value || 0) / limit)
      }
    } catch (error) {
      console.error('Error searching contacts:', error)
      throw error
    }
  }

  // Auto-suggest for search-as-you-type
  async suggestContacts(query: string, size: number = 10) {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          suggest: {
            contact_suggest: {
              prefix: query,
              completion: {
                field: 'fullName.suggest',
                size,
                skip_duplicates: true
              }
            }
          }
        }
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })

      return response.suggest.contact_suggest[0].options.map((option: any) => ({
        text: option.text,
        score: option._score,
        source: option._source
      }))
    } catch (error) {
      console.error('Error getting contact suggestions:', error)
      return []
    }
  }

  // Aggregations for dashboard stats
  async getContactAggregations() {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            by_deal_status: {
              terms: { field: 'dealStatus', size: 20 }
            },
            by_property_type: {
              terms: { field: 'propertyType', size: 20 }
            },
            by_state: {
              terms: { field: 'state', size: 50 }
            },
            by_city: {
              terms: { field: 'city.keyword', size: 100 }
            },
            value_stats: {
              stats: { field: 'estValue' }
            },
            dnc_count: {
              terms: { field: 'dnc' }
            },
            created_over_time: {
              date_histogram: {
                field: 'createdAt',
                calendar_interval: 'month'
              }
            }
          }
        }
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })

      return response.aggregations
    } catch (error) {
      console.error('Error getting contact aggregations:', error)
      throw error
    }
  }

  // Update a contact
  async updateContact(id: string, updates: Partial<ContactDocument>) {
    try {
      await this.client.update({
        index: this.indexName,
        id,
        body: {
          doc: {
            ...updates,
            ...(updates.firstName || updates.lastName ? {
              fullName: `${updates.firstName || ''} ${updates.lastName || ''}`.trim()
            } : {})
          }
        }
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })
    } catch (error) {
      console.error('Error updating contact:', error)
      throw error
    }
  }

  // Delete a contact
  async deleteContact(id: string) {
    try {
      await this.client.delete({
        index: this.indexName,
        id
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })
    } catch (error) {
      console.error('Error deleting contact:', error)
      throw error
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.ping({}, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8' } })
      return response.statusCode === 200
    } catch (error) {
      return false
    }
  }

  // Get index statistics
  async getIndexStats() {
    try {
      const response = await this.client.indices.stats({
        index: this.indexName
      }, { headers: { accept: 'application/vnd.elasticsearch+json; compatible-with=8', 'content-type': 'application/vnd.elasticsearch+json; compatible-with=8' } })
      return response.indices[this.indexName]
    } catch (error) {
      console.error('Error getting index stats:', error)
      return null
    }
  }
}

export const elasticsearchClient = new ElasticsearchClient()

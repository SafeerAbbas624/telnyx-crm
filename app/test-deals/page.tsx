'use client'

import { useEffect, useState } from 'react'

export default function TestDealsPage() {
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true)
        console.log('🔄 Fetching deals from /api/deals...')
        const response = await fetch('/api/deals?pipeline=default&limit=10')
        console.log('📡 Response status:', response.status)
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }
        
        const data = await response.json()
        console.log('📦 Response data:', data)
        setDeals(data.deals || [])
      } catch (err) {
        console.error('❌ Error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDeals()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Test Deals Page</h1>
      
      {loading && <p className="text-blue-600">Loading...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      
      {!loading && !error && (
        <div>
          <p className="mb-4 text-lg font-semibold">Found {deals.length} deals</p>
          
          <div className="space-y-4">
            {deals.map((deal) => (
              <div key={deal.id} className="border p-4 rounded-lg bg-gray-50">
                <h3 className="font-bold text-lg">{deal.title}</h3>
                <p className="text-sm text-gray-600">ID: {deal.id}</p>
                <p className="text-sm">Stage: {deal.stage}</p>
                <p className="text-sm">Value: ${deal.value.toLocaleString()}</p>
                <p className="text-sm">Probability: {deal.probability}%</p>
                <p className="text-sm">Pipeline ID: {deal.pipelineId}</p>
                {deal.loanData && (
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <p className="text-sm font-semibold">Loan Data:</p>
                    <p className="text-sm">Lender: {deal.loanData.lender}</p>
                    <p className="text-sm">DSCR: {deal.loanData.dscr}</p>
                    <p className="text-sm">LTV: {deal.loanData.ltv}%</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


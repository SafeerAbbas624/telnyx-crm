"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Loader2, CheckCircle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SeedResponse {
  success: boolean;
  message: string;
  counts?: {
    contacts: number;
    messages: number;
    calls: number;
    activities: number;
    emails: number;
    deals: number;
    conversations: number;
  };
  error?: string;
  details?: string;
}

export default function SeedDatabaseButton() {
  const [isSeeding, setIsSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<SeedResponse | null>(null)
  const [currentCounts, setCurrentCounts] = useState<SeedResponse['counts'] | null>(null)

  const getCurrentCounts = async () => {
    try {
      const response = await fetch('/api/seed', { method: 'GET' })
      const data = await response.json()
      if (data.success) {
        setCurrentCounts(data.counts)
      }
    } catch (error) {
      console.error('Error getting current counts:', error)
    }
  }

  const seedDatabase = async () => {
    setIsSeeding(true)
    setSeedResult(null)
    
    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data: SeedResponse = await response.json()
      setSeedResult(data)
      
      if (data.success) {
        // Refresh current counts
        await getCurrentCounts()
      }
    } catch (error) {
      setSeedResult({
        success: false,
        message: 'Failed to seed database',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSeeding(false)
    }
  }

  // Load current counts on component mount
  useState(() => {
    getCurrentCounts()
  })

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-4 w-4" />
          Database Seeding Tool
        </CardTitle>
        <CardDescription className="text-sm">
          Populate your database with dummy data to test all dashboard features. This will add realistic sample data for messages, calls, activities, emails, deals, and conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Counts */}
        {currentCounts && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Current Database Counts:</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">Contacts: {currentCounts.contacts}</Badge>
              <Badge variant="outline" className="text-xs">Messages: {currentCounts.messages}</Badge>
              <Badge variant="outline" className="text-xs">Calls: {currentCounts.calls}</Badge>
              <Badge variant="outline" className="text-xs">Activities: {currentCounts.activities}</Badge>
              <Badge variant="outline" className="text-xs">Emails: {currentCounts.emails}</Badge>
              <Badge variant="outline" className="text-xs">Deals: {currentCounts.deals}</Badge>
              <Badge variant="outline" className="text-xs">Conversations: {currentCounts.conversations}</Badge>
            </div>
          </div>
        )}

        {/* Seed Button */}
        <div className="flex gap-2">
          <Button 
            onClick={seedDatabase} 
            disabled={isSeeding}
            className="flex items-center gap-2"
            size="sm"
          >
            {isSeeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Seeding Database...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Seed Database with Dummy Data
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={getCurrentCounts}
            className="flex items-center gap-2"
            size="sm"
          >
            <Database className="h-4 w-4" />
            Refresh Counts
          </Button>
        </div>

        {/* Result Display */}
        {seedResult && (
          <div className={`p-4 rounded-lg border ${
            seedResult.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {seedResult.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-medium">{seedResult.message}</span>
            </div>
            
            {seedResult.success && seedResult.counts && (
              <div className="space-y-1 text-sm">
                <p><strong>Data Added:</strong></p>
                <div className="grid grid-cols-2 gap-2 ml-4">
                  <span>• Messages: {seedResult.counts.messages}</span>
                  <span>• Calls: {seedResult.counts.calls}</span>
                  <span>• Activities: {seedResult.counts.activities}</span>
                  <span>• Emails: {seedResult.counts.emails}</span>
                  <span>• Deals: {seedResult.counts.deals}</span>
                  <span>• Conversations: {seedResult.counts.conversations}</span>
                </div>
              </div>
            )}
            
            {!seedResult.success && seedResult.details && (
              <p className="text-sm mt-2">
                <strong>Details:</strong> {seedResult.details}
              </p>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>What this will add:</strong></p>
          <div className="grid grid-cols-2 gap-1 ml-2 mt-1">
            <span>• ~150 text messages</span>
            <span>• ~80 call records</span>
            <span>• ~120 activities</span>
            <span>• ~60 emails</span>
            <span>• ~40 deals</span>
            <span>• ~50 conversations</span>
          </div>
          <p className="mt-2 text-xs">
            <strong>Note:</strong> Uses your existing contacts to create realistic relationships.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
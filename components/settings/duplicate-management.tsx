"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Loader2, Users, Home, Merge } from "lucide-react"
import { toast } from "sonner"

interface DuplicateGroup {
  phone: string
  contacts: Array<{
    id: string
    name: string
    phone: string
    propertyAddress: string | null
    propertyCount: number
    createdAt: string
  }>
}

interface ScrubPreview {
  totalContacts: number
  duplicateGroups: number
  contactsToMerge: number
  propertiesConsolidated: number
  groups: DuplicateGroup[]
}

export default function DuplicateManagement() {
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState(false)
  const [preview, setPreview] = useState<ScrubPreview | null>(null)
  const [mergeResult, setMergeResult] = useState<{ merged: number; properties: number } | null>(null)

  const handleScanDuplicates = async () => {
    setLoading(true)
    setPreview(null)
    setMergeResult(null)

    try {
      const response = await fetch('/api/admin/contacts/scrub-duplicates')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan for duplicates')
      }

      setPreview(data.preview)
      
      if (data.preview.duplicateGroups === 0) {
        toast.success('No duplicates found! Your CRM is clean.')
      } else {
        toast.info(`Found ${data.preview.duplicateGroups} duplicate groups`)
      }
    } catch (error) {
      console.error('Error scanning duplicates:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to scan for duplicates')
    } finally {
      setLoading(false)
    }
  }

  const handleMergeDuplicates = async () => {
    if (!preview || preview.duplicateGroups === 0) return

    setMerging(true)

    try {
      const response = await fetch('/api/admin/contacts/scrub-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execute: true }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to merge duplicates')
      }

      setMergeResult({
        merged: data.result.groupsMerged,
        properties: data.result.propertiesConsolidated,
      })
      setPreview(null)
      toast.success(`Successfully merged ${data.result.groupsMerged} duplicate groups!`)
    } catch (error) {
      console.error('Error merging duplicates:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to merge duplicates')
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Duplicate Contact Management
          </CardTitle>
          <CardDescription>
            Scan your CRM for duplicate contacts (same phone number) and merge them automatically.
            Properties from duplicate contacts will be consolidated into the primary contact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={handleScanDuplicates} disabled={loading || merging}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                'Scan for Duplicates'
              )}
            </Button>
            {preview && preview.duplicateGroups > 0 && (
              <Button onClick={handleMergeDuplicates} disabled={merging} variant="destructive">
                {merging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Merge className="mr-2 h-4 w-4" />
                    Merge All Duplicates
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Success Result */}
          {mergeResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Merge Complete!</p>
                <p className="text-sm text-green-700">
                  Merged {mergeResult.merged} duplicate groups and consolidated {mergeResult.properties} properties.
                </p>
              </div>
            </div>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl font-bold">{preview.totalContacts}</p>
                </Card>
                <Card className="p-4 border-orange-200 bg-orange-50/50">
                  <p className="text-sm text-orange-700">Duplicate Groups</p>
                  <p className="text-2xl font-bold text-orange-700">{preview.duplicateGroups}</p>
                </Card>
                <Card className="p-4 border-red-200 bg-red-50/50">
                  <p className="text-sm text-red-700">Contacts to Merge</p>
                  <p className="text-2xl font-bold text-red-700">{preview.contactsToMerge}</p>
                </Card>
                <Card className="p-4 border-blue-200 bg-blue-50/50">
                  <p className="text-sm text-blue-700">Properties to Consolidate</p>
                  <p className="text-2xl font-bold text-blue-700">{preview.propertiesConsolidated}</p>
                </Card>
              </div>

              {/* Duplicate Groups List */}
              {preview.groups.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Duplicate Groups (showing first 20)</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {preview.groups.slice(0, 20).map((group, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{group.phone}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {group.contacts.length} contacts
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {group.contacts.map((contact, cIdx) => (
                            <div key={contact.id} className="flex items-center gap-2">
                              {cIdx === 0 && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Primary</Badge>
                              )}
                              {cIdx > 0 && (
                                <Badge variant="secondary" className="text-xs">Will merge</Badge>
                              )}
                              <span className="font-medium">{contact.name}</span>
                              {contact.propertyAddress && (
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Home className="h-3 w-3" />
                                  {contact.propertyAddress}
                                </span>
                              )}
                              {contact.propertyCount > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  +{contact.propertyCount - 1} properties
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                    {preview.groups.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        ...and {preview.groups.length - 20} more groups
                      </p>
                    )}
                  </div>
                </div>
              )}

              {preview.duplicateGroups === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">No Duplicates Found</p>
                    <p className="text-sm text-green-700">Your CRM is clean - no contacts share the same phone number.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


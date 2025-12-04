'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Trash2, Tag } from 'lucide-react'

interface BulkCallActionsProps {
  selectedCount: number
  selectedCallIds: string[]
  onActionComplete?: () => void
}

export function BulkCallActions({
  selectedCount,
  selectedCallIds,
  onActionComplete,
}: BulkCallActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<string>('')
  const { toast } = useToast()

  if (selectedCount === 0) {
    return null
  }

  const handleBulkSetOutcome = async () => {
    if (!selectedOutcome) {
      toast({
        title: 'Error',
        description: 'Please select an outcome',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/calls/bulk-disposition', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callIds: selectedCallIds,
          outcome: selectedOutcome,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update calls')
      }

      toast({
        title: 'Success',
        description: `Updated ${selectedCount} calls to ${selectedOutcome}`,
      })

      setSelectedOutcome('')
      onActionComplete?.()
    } catch (error) {
      console.error('Error updating calls:', error)
      toast({
        title: 'Error',
        description: 'Failed to update calls',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/calls/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callIds: selectedCallIds,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete calls')
      }

      toast({
        title: 'Success',
        description: `Deleted ${selectedCount} calls`,
      })

      setShowDeleteConfirm(false)
      onActionComplete?.()
    } catch (error) {
      console.error('Error deleting calls:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete calls',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted p-4">
        <span className="text-sm font-medium">{selectedCount} call(s) selected</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Bulk Set Outcome */}
          <div className="flex items-center gap-2">
            <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Set outcome..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interested">✅ Interested</SelectItem>
                <SelectItem value="not_interested">❌ Not Interested</SelectItem>
                <SelectItem value="callback">📞 Callback</SelectItem>
                <SelectItem value="voicemail">📧 Voicemail</SelectItem>
                <SelectItem value="wrong_number">❓ Wrong Number</SelectItem>
                <SelectItem value="no_answer">⏱️ No Answer</SelectItem>
                <SelectItem value="busy">🔴 Busy</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={handleBulkSetOutcome}
              disabled={isLoading || !selectedOutcome}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </div>

          {/* Bulk Delete */}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calls</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} call(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


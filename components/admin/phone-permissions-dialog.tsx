"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Phone, CheckCircle2 } from "lucide-react"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  state?: string
  city?: string
  isActive: boolean
}

interface TeamUser {
  id: string
  firstName: string
  lastName: string
  email: string
  defaultPhoneNumberId?: string
  allowedPhoneNumbers?: TelnyxPhoneNumber[]
}

interface PhonePermissionsDialogProps {
  isOpen: boolean
  onClose: () => void
  user: TeamUser
  onSuccess: () => void
}

export default function PhonePermissionsDialog({ 
  isOpen, 
  onClose, 
  user, 
  onSuccess 
}: PhonePermissionsDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [allNumbers, setAllNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [allowedIds, setAllowedIds] = useState<Set<string>>(new Set())
  const [defaultPhoneNumberId, setDefaultPhoneNumberId] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      fetchPermissions()
    }
  }, [isOpen, user.id])

  const fetchPermissions = async () => {
    setIsFetching(true)
    try {
      const response = await fetch(`/api/admin/team-users/${user.id}/phone-permissions`)
      if (!response.ok) throw new Error('Failed to fetch permissions')
      
      const data = await response.json()
      setAllNumbers(data.allAvailableNumbers || [])
      setAllowedIds(new Set(data.allowedPhoneNumbers?.map((n: TelnyxPhoneNumber) => n.id) || []))
      setDefaultPhoneNumberId(data.defaultPhoneNumberId || "")
    } catch (error) {
      console.error('Error fetching phone permissions:', error)
      toast({
        title: 'Error',
        description: 'Failed to load phone permissions',
        variant: 'destructive',
      })
    } finally {
      setIsFetching(false)
    }
  }

  const handleToggleNumber = (numberId: string) => {
    const newAllowedIds = new Set(allowedIds)
    if (newAllowedIds.has(numberId)) {
      newAllowedIds.delete(numberId)
      // If removing the default, clear it
      if (defaultPhoneNumberId === numberId) {
        setDefaultPhoneNumberId("")
      }
    } else {
      newAllowedIds.add(numberId)
    }
    setAllowedIds(newAllowedIds)
  }

  const handleGrantAll = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/team-users/${user.id}/phone-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantAll: true }),
      })
      if (!response.ok) throw new Error('Failed to grant all numbers')
      
      toast({ title: 'Success', description: 'All phone numbers granted' })
      fetchPermissions()
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to grant all numbers', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeAll = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/team-users/${user.id}/phone-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAll: true }),
      })
      if (!response.ok) throw new Error('Failed to revoke all numbers')
      
      toast({ title: 'Success', description: 'All phone numbers revoked' })
      setAllowedIds(new Set())
      setDefaultPhoneNumberId("")
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to revoke all numbers', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    // Validate default is in allowed
    if (defaultPhoneNumberId && !allowedIds.has(defaultPhoneNumberId)) {
      toast({
        title: 'Validation Error',
        description: 'Default phone number must be one of the allowed numbers',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/team-users/${user.id}/phone-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedPhoneNumberIds: Array.from(allowedIds),
          defaultPhoneNumberId: defaultPhoneNumberId || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to update permissions')

      toast({ title: 'Success', description: 'Phone permissions updated' })
      onSuccess()
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update permissions', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const allowedNumbers = allNumbers.filter(n => allowedIds.has(n.id))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Permissions - {user.firstName} {user.lastName}
          </DialogTitle>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGrantAll}
                disabled={isLoading}
              >
                Grant All Numbers
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeAll}
                disabled={isLoading}
              >
                Revoke All Numbers
              </Button>
            </div>

            {/* Default Number Selection */}
            <div className="space-y-2">
              <Label>Default Phone Number</Label>
              <Select
                value={defaultPhoneNumberId}
                onValueChange={setDefaultPhoneNumberId}
                disabled={allowedIds.size === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={allowedIds.size === 0 ? "No numbers allowed" : "Select default number"} />
                </SelectTrigger>
                <SelectContent>
                  {allowedNumbers.map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                      {formatPhoneNumberForDisplay(phone.phoneNumber)}
                      {phone.friendlyName && ` - ${phone.friendlyName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This number will be pre-selected when the user sends SMS or makes calls.
              </p>
            </div>

            {/* Allowed Numbers Multi-Select */}
            <div className="space-y-2">
              <Label>Allowed Phone Numbers ({allowedIds.size} of {allNumbers.length})</Label>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {allNumbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No phone numbers available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {allNumbers.map((phone) => (
                      <div
                        key={phone.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleToggleNumber(phone.id)}
                      >
                        <Checkbox
                          checked={allowedIds.has(phone.id)}
                          onCheckedChange={() => handleToggleNumber(phone.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {formatPhoneNumberForDisplay(phone.phoneNumber)}
                            </span>
                            {defaultPhoneNumberId === phone.id && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          {phone.friendlyName && (
                            <span className="text-xs text-muted-foreground">{phone.friendlyName}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isFetching}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


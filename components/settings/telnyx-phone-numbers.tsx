"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Phone, Plus, Loader2, Trash2, Edit2, MessageSquare, PhoneCall } from "lucide-react"
import { toast } from "sonner"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  telnyxId?: string
  state?: string
  city?: string
  isActive: boolean
  capabilities: string[]
  monthlyPrice?: number
  totalSmsCount: number
  totalCallCount: number
  lastUsedAt?: string
  createdAt: string
}

export default function TelnyxPhoneNumbers() {
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingNumber, setEditingNumber] = useState<TelnyxPhoneNumber | null>(null)
  const [newNumber, setNewNumber] = useState({
    phoneNumber: '',
    friendlyName: '',
    telnyxId: '',
    state: '',
    city: '',
  })
  const [adding, setAdding] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchPhoneNumbers()
  }, [])

  const fetchPhoneNumbers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/telnyx/phone-numbers')
      const data = await response.json()
      setPhoneNumbers(data)
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
      toast.error('Failed to load phone numbers')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNumber = async () => {
    if (!newNumber.phoneNumber) {
      toast.error('Phone number is required')
      return
    }

    try {
      setAdding(true)
      const response = await fetch('/api/telnyx/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNumber),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add phone number')
      }

      toast.success('Phone number added successfully')
      setShowAddDialog(false)
      setNewNumber({ phoneNumber: '', friendlyName: '', telnyxId: '', state: '', city: '' })
      fetchPhoneNumbers()
    } catch (error) {
      console.error('Error adding phone number:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add phone number')
    } finally {
      setAdding(false)
    }
  }

  const handleEditNumber = (number: TelnyxPhoneNumber) => {
    setEditingNumber(number)
    setShowEditDialog(true)
  }

  const handleUpdateNumber = async () => {
    if (!editingNumber) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/telnyx/phone-numbers/${editingNumber.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendlyName: editingNumber.friendlyName,
          state: editingNumber.state,
          city: editingNumber.city,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update phone number')
      }

      toast.success('Phone number updated successfully')
      setShowEditDialog(false)
      setEditingNumber(null)
      fetchPhoneNumbers()
    } catch (error) {
      console.error('Error updating phone number:', error)
      toast.error('Failed to update phone number')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteNumber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phone number?')) return

    try {
      const response = await fetch(`/api/telnyx/phone-numbers/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete phone number')
      }

      toast.success('Phone number deleted successfully')
      fetchPhoneNumbers()
    } catch (error) {
      console.error('Error deleting phone number:', error)
      toast.error('Failed to delete phone number')
    }
  }

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Phone Numbers</h2>
          <p className="text-muted-foreground">Manage your Telnyx phone numbers for calls and SMS</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Number
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : phoneNumbers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No phone numbers yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first Telnyx phone number to start making calls and sending SMS
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Number
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {phoneNumbers.map((number) => (
            <Card key={number.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{formatPhoneNumber(number.phoneNumber)}</CardTitle>
                    {number.friendlyName && (
                      <CardDescription className="text-base font-medium">{number.friendlyName}</CardDescription>
                    )}
                    <CardDescription>
                      {number.city && number.state ? `${number.city}, ${number.state}` : number.state || 'No location'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditNumber(number)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteNumber(number.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={number.isActive ? "default" : "secondary"}>
                      {number.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {number.capabilities.map((cap) => (
                    <Badge key={cap} variant="outline">
                      {cap === 'SMS' ? <MessageSquare className="h-3 w-3 mr-1" /> : <PhoneCall className="h-3 w-3 mr-1" />}
                      {cap}
                    </Badge>
                  ))}
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{number.totalCallCount}</span> calls
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{number.totalSmsCount}</span> SMS
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Number Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Telnyx Phone Number</DialogTitle>
            <DialogDescription>
              Add a phone number from your Telnyx account. Make sure the number is already purchased in Telnyx.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                placeholder="+12345678900"
                value={newNumber.phoneNumber}
                onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Enter in E.164 format (e.g., +12345678900)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="friendlyName">Friendly Name (Optional)</Label>
              <Input
                id="friendlyName"
                placeholder="Main Business Line"
                value={newNumber.friendlyName}
                onChange={(e) => setNewNumber({ ...newNumber, friendlyName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Give this number a memorable name
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telnyxId">Telnyx ID (Optional)</Label>
              <Input
                id="telnyxId"
                placeholder="Enter Telnyx phone number ID"
                value={newNumber.telnyxId}
                onChange={(e) => setNewNumber({ ...newNumber, telnyxId: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City (Optional)</Label>
                <Input
                  id="city"
                  placeholder="Miami"
                  value={newNumber.city}
                  onChange={(e) => setNewNumber({ ...newNumber, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State (Optional)</Label>
                <Input
                  id="state"
                  placeholder="FL"
                  value={newNumber.state}
                  onChange={(e) => setNewNumber({ ...newNumber, state: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={handleAddNumber} disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Number
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Number Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Phone Number</DialogTitle>
            <DialogDescription>
              Update the friendly name and location for this phone number
            </DialogDescription>
          </DialogHeader>
          {editingNumber && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={formatPhoneNumber(editingNumber.phoneNumber)} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editFriendlyName">Friendly Name</Label>
                <Input
                  id="editFriendlyName"
                  placeholder="Main Business Line"
                  value={editingNumber.friendlyName || ''}
                  onChange={(e) => setEditingNumber({ ...editingNumber, friendlyName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editCity">City</Label>
                  <Input
                    id="editCity"
                    placeholder="Miami"
                    value={editingNumber.city || ''}
                    onChange={(e) => setEditingNumber({ ...editingNumber, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editState">State</Label>
                  <Input
                    id="editState"
                    placeholder="FL"
                    value={editingNumber.state || ''}
                    onChange={(e) => setEditingNumber({ ...editingNumber, state: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNumber} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


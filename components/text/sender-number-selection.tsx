"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Phone, Plus, X, RotateCcw, Settings, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TelnyxPhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
  capabilities?: string[]
  totalSmsCount?: number
  totalCallCount?: number
  totalCost?: string | number
  isActive?: boolean
  telnyxId?: string | null
  state?: string
  city?: string | null
  country?: string
  monthlyPrice?: string | null
  setupPrice?: string | null
  purchasedAt?: string
  lastUsedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

interface SenderNumberSelectionProps {
  availableNumbers: TelnyxPhoneNumber[]
  selectedNumbers: TelnyxPhoneNumber[]
  onSelectedNumbersChange: (numbers: TelnyxPhoneNumber[]) => void
  selectionMode: "single" | "multiple" | "all"
  onSelectionModeChange: (mode: "single" | "multiple" | "all") => void
  rotationEnabled: boolean
  onRotationEnabledChange: (enabled: boolean) => void
}

export default function SenderNumberSelection({
  availableNumbers,
  selectedNumbers,
  onSelectedNumbersChange,
  selectionMode,
  onSelectionModeChange,
  rotationEnabled,
  onRotationEnabledChange,
}: SenderNumberSelectionProps) {
  const [showAddNumberDialog, setShowAddNumberDialog] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState("")
  const [newFriendlyName, setNewFriendlyName] = useState("")
  const { toast } = useToast()

  // Debug logging
  console.log('SenderNumberSelection - availableNumbers:', availableNumbers)
  console.log('SenderNumberSelection - availableNumbers length:', availableNumbers.length)

  // Auto-select all numbers when mode is "all"
  useEffect(() => {
    if (selectionMode === "all") {
      onSelectedNumbersChange(availableNumbers.filter(num => num.isActive !== false))
    }
  }, [selectionMode, availableNumbers, onSelectedNumbersChange])

  // Ensure single selection when mode is "single"
  useEffect(() => {
    if (selectionMode === "single" && selectedNumbers.length > 1) {
      onSelectedNumbersChange([selectedNumbers[0]])
    }
  }, [selectionMode, selectedNumbers, onSelectedNumbersChange])

  const handleNumberToggle = (number: TelnyxPhoneNumber) => {
    if (selectionMode === "all") return // Can't manually toggle in "all" mode

    const isSelected = selectedNumbers.some(n => n.id === number.id)
    
    if (selectionMode === "single") {
      onSelectedNumbersChange(isSelected ? [] : [number])
    } else {
      if (isSelected) {
        onSelectedNumbersChange(selectedNumbers.filter(n => n.id !== number.id))
      } else {
        onSelectedNumbersChange([...selectedNumbers, number])
      }
    }
  }

  const handleAddNumber = async () => {
    if (!newPhoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter a phone number",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/telnyx/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: newPhoneNumber,
          friendlyName: newFriendlyName || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add phone number')
      }

      toast({
        title: "Phone number added",
        description: `${newPhoneNumber} has been added successfully`,
      })

      setNewPhoneNumber("")
      setNewFriendlyName("")
      setShowAddNumberDialog(false)
      
      // Refresh the numbers list (you might want to call a refresh function here)
    } catch (error) {
      toast({
        title: "Error adding phone number",
        description: "Failed to add the phone number. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getRotationPreview = () => {
    if (!rotationEnabled || selectedNumbers.length <= 1) return null
    
    return (
      <div className="text-xs text-muted-foreground mt-2">
        <RotateCcw className="h-3 w-3 inline mr-1" />
        Numbers will rotate: {selectedNumbers.map(n => n.phoneNumber).join(" → ")}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Sender Numbers
          <Badge variant="secondary" className="ml-auto">
            {selectedNumbers.length} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Mode */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Selection Mode</Label>
          <ToggleGroup
            type="single"
            value={selectionMode}
            onValueChange={(value: any) => value && onSelectionModeChange(value)}
            className="flex gap-2"
          >
            <ToggleGroupItem value="single" aria-label="Single Number">Single</ToggleGroupItem>
            <ToggleGroupItem value="multiple" aria-label="Multiple Numbers">Multiple</ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="All Numbers">All</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Rotation Settings */}
        {selectionMode === "multiple" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rotation"
              checked={rotationEnabled}
              onCheckedChange={onRotationEnabledChange}
            />
            <Label htmlFor="rotation" className="text-sm">
              Enable number rotation during sending
            </Label>
          </div>
        )}

        {/* Available Numbers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Available Numbers</Label>
            <Dialog open={showAddNumberDialog} onOpenChange={setShowAddNumberDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Number
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Telnyx Phone Number</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      placeholder="+1234567890"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="friendlyName">Friendly Name (Optional)</Label>
                    <Input
                      id="friendlyName"
                      placeholder="Main Business Line"
                      value={newFriendlyName}
                      onChange={(e) => setNewFriendlyName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddNumber} className="flex-1">
                      Add Number
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddNumberDialog(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[200px] border rounded-md p-2">
            <div className="space-y-2">
              {availableNumbers.map(number => {
                const isSelected = selectedNumbers.some(n => n.id === number.id)
                const isDisabled = selectionMode === "all" || (number.isActive === false)
                
                return (
                  <div
                    key={number.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? "bg-primary/5 border-primary" 
                        : "hover:bg-gray-50"
                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => !isDisabled && handleNumberToggle(number)}
                  >
                    <Checkbox 
                      checked={isSelected} 
                      disabled={isDisabled}
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{number.phoneNumber}</span>
                        {number.friendlyName && (
                          <Badge variant="outline" className="text-xs">
                            {number.friendlyName}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {number.capabilities?.join(', ')} • 
                        SMS: {number.totalSmsCount || 0} •
                        Calls: {number.totalCallCount || 0} •
                        Cost: ${(parseFloat(number.totalCost?.toString() || '0')).toFixed(2)}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                )
              })}
              
              {availableNumbers.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No phone numbers available</p>
                  <p className="text-xs">Add a Telnyx phone number to get started</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Rotation Preview */}
        {getRotationPreview()}

        {/* Selection Summary */}
        {selectedNumbers.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium mb-2">Selected Numbers:</div>
            <div className="flex flex-wrap gap-1">
              {selectedNumbers.map(number => (
                <Badge key={number.id} variant="secondary" className="text-xs">
                  {number.phoneNumber}
                  {number.friendlyName && ` (${number.friendlyName})`}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

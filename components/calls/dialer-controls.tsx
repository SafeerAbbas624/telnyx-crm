'use client'

/**
 * Multi-Line Power Dialer Controls
 * 
 * Start/Pause/Stop controls with line count selector and safety warnings.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Play, 
  Pause, 
  Square, 
  Phone, 
  AlertTriangle,
  Settings,
  Zap
} from 'lucide-react'
import type { DialerRunState, CallerIdStrategy } from '@/lib/dialer/types'
import { cn } from '@/lib/utils'

interface PhoneNumber {
  id: string
  phoneNumber: string
  friendlyName?: string
}

interface DialerControlsProps {
  listId: string
  listName: string
  totalContacts: number
  runState: DialerRunState | null
  phoneNumbers: PhoneNumber[]
  selectedNumbers: string[]
  maxLines: number
  callerIdStrategy: CallerIdStrategy
  isLoading: boolean
  onStart: (config: { maxLines: number; callerIdStrategy: CallerIdStrategy; phoneNumberIds: string[] }) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onMaxLinesChange: (lines: number) => void
  onCallerIdStrategyChange: (strategy: CallerIdStrategy) => void
  onSelectedNumbersChange: (ids: string[]) => void
}

export function DialerControls({
  listId,
  listName,
  totalContacts,
  runState,
  phoneNumbers,
  selectedNumbers,
  maxLines,
  callerIdStrategy,
  isLoading,
  onStart,
  onPause,
  onResume,
  onStop,
  onMaxLinesChange,
  onCallerIdStrategyChange,
  onSelectedNumbersChange
}: DialerControlsProps) {
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showStartConfirm, setShowStartConfirm] = useState(false)

  const isRunning = runState?.status === 'running'
  const isPaused = runState?.status === 'paused'
  const isCompleted = runState?.status === 'completed'
  const hasActiveRun = isRunning || isPaused

  const canStart = !hasActiveRun && selectedNumbers.length > 0 && totalContacts > 0
  const needsMoreNumbers = maxLines > selectedNumbers.length

  const handleStartClick = () => {
    if (maxLines > 3) {
      setShowStartConfirm(true)
    } else {
      handleConfirmStart()
    }
  }

  const handleConfirmStart = () => {
    setShowStartConfirm(false)
    onStart({
      maxLines,
      callerIdStrategy,
      phoneNumberIds: selectedNumbers
    })
  }

  const handleStopClick = () => {
    setShowStopConfirm(true)
  }

  const handleConfirmStop = () => {
    setShowStopConfirm(false)
    onStop()
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Dialer Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Line Count Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Concurrent Lines
            </Label>
            <Select
              value={maxLines.toString()}
              onValueChange={(v) => onMaxLinesChange(parseInt(v))}
              disabled={hasActiveRun}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? 'Line' : 'Lines'}
                    {n > 5 && <span className="text-orange-500 ml-2">(High Volume)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsMoreNumbers && (
              <p className="text-xs text-orange-600">
                ⚠️ Select at least {maxLines} phone numbers for {maxLines} lines
              </p>
            )}
          </div>

          {/* Caller ID Strategy */}
          <div className="space-y-2">
            <Label>Caller ID Rotation</Label>
            <Select
              value={callerIdStrategy}
              onValueChange={(v) => onCallerIdStrategyChange(v as CallerIdStrategy)}
              disabled={hasActiveRun}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round Robin</SelectItem>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="single_number">Single Number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Phone Number Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Caller IDs ({selectedNumbers.length} selected)
            </Label>
            <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
              {phoneNumbers.map(phone => (
                <label
                  key={phone.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                    selectedNumbers.includes(phone.id)
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted',
                    hasActiveRun && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedNumbers.includes(phone.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectedNumbersChange([...selectedNumbers, phone.id])
                      } else {
                        onSelectedNumbersChange(selectedNumbers.filter(id => id !== phone.id))
                      }
                    }}
                    disabled={hasActiveRun}
                    className="h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm">{phone.phoneNumber}</div>
                    {phone.friendlyName && (
                      <div className="text-xs text-muted-foreground truncate">{phone.friendlyName}</div>
                    )}
                  </div>
                </label>
              ))}
              {phoneNumbers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No phone numbers available
                </p>
              )}
            </div>
          </div>

          {/* Warning for high volume */}
          {maxLines > 3 && !hasActiveRun && (
            <Alert variant="destructive" className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">High Volume Mode</AlertTitle>
              <AlertDescription className="text-orange-700 text-sm">
                Dialing {maxLines} lines simultaneously will make {maxLines} calls at once.
                Ensure you have sufficient phone numbers and are compliant with calling regulations.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!hasActiveRun ? (
              <Button
                className="flex-1"
                onClick={handleStartClick}
                disabled={!canStart || isLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Dialing
              </Button>
            ) : isPaused ? (
              <>
                <Button
                  className="flex-1"
                  onClick={onResume}
                  disabled={isLoading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleStopClick}
                  disabled={isLoading}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onPause}
                  disabled={isLoading}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleStopClick}
                  disabled={isLoading}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>

          {/* Status Badge */}
          {runState && (
            <div className="flex items-center justify-center pt-2">
              <Badge
                variant={
                  isRunning ? 'default' :
                  isPaused ? 'secondary' :
                  isCompleted ? 'outline' : 'destructive'
                }
                className={cn(
                  'text-sm px-4 py-1',
                  isRunning && 'animate-pulse bg-green-600'
                )}
              >
                {isRunning ? '● Running' :
                 isPaused ? '⏸ Paused' :
                 isCompleted ? '✓ Completed' : runState.status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Confirmation Dialog */}
      <Dialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm High Volume Dialing
            </DialogTitle>
            <DialogDescription>
              You are about to start dialing with <strong>{maxLines} concurrent lines</strong>.
              This will make up to {maxLines} simultaneous outbound calls.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• {totalContacts} contacts will be dialed</li>
              <li>• Using {selectedNumbers.length} phone numbers</li>
              <li>• Caller ID strategy: {callerIdStrategy.replace('_', ' ')}</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmStart}>
              Start Dialing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Confirmation Dialog */}
      <Dialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-5 w-5 text-red-500" />
              Stop Dialer Run?
            </DialogTitle>
            <DialogDescription>
              This will immediately hang up all active calls and stop the dialer.
              Progress will be saved and you can resume from where you left off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStopConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmStop}>
              Stop Dialer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


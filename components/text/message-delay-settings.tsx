"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface MessageDelaySettingsProps {
  delaySeconds: number
  onDelaySecondsChange: (seconds: number) => void
}

export default function MessageDelaySettings({
  delaySeconds,
  onDelaySecondsChange,
}: MessageDelaySettingsProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h4 className="font-medium mb-2">Message Delay Settings</h4>
        <p className="text-sm text-muted-foreground mb-4">Set the delay between messages (in seconds)</p>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Delay (seconds)</Label>
          <Input
            type="number"
            min="1"
            max="60"
            value={delaySeconds}
            onChange={(e) => onDelaySecondsChange(Number(e.target.value) || 1)}
            placeholder="Enter delay in seconds"
          />
          <p className="text-xs text-muted-foreground">
            A {delaySeconds} second delay will be applied between messages to avoid rate limits
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

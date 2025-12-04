'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { useVapiStore, type VapiApiKey } from '@/lib/stores/useVapiStore'
import { toast } from 'sonner'

export default function VapiSettings() {
  const { apiKeys, setApiKeys } = useVapiStore()
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [settings, setSettings] = useState({
    maxCallDuration: 600,
    recordingEnabled: true,
    transcriptEnabled: true,
    webhookUrl: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (apiKeys.length > 0 && !selectedKeyId) {
      const defaultKey = apiKeys.find(k => k.isDefault) || apiKeys[0]
      setSelectedKeyId(defaultKey.id)
      loadKeySettings(defaultKey.id)
    }
  }, [apiKeys])

  const loadKeySettings = (keyId: string) => {
    const key = apiKeys.find(k => k.id === keyId)
    if (key) {
      setSettings({
        maxCallDuration: key.maxCallDuration || 600,
        recordingEnabled: key.recordingEnabled,
        transcriptEnabled: key.transcriptEnabled,
        webhookUrl: key.webhookUrl || '',
      })
    }
  }

  const handleKeyChange = (keyId: string) => {
    setSelectedKeyId(keyId)
    loadKeySettings(keyId)
  }

  const handleSaveSettings = async () => {
    if (!selectedKeyId) {
      toast.error('Please select an API key')
      return
    }

    try {
      setIsSaving(true)
      const response = await fetch(`/api/vapi/keys/${selectedKeyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Settings saved successfully')
        // Refresh API keys
        const keysResponse = await fetch('/api/vapi/keys')
        const keysData = await keysResponse.json()
        if (keysData.success) {
          setApiKeys(keysData.keys)
        }
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-gray-600">Configure Vapi AI call behavior</p>
      </div>

      {/* Select API Key */}
      <Card className="p-6">
        <label className="block text-sm font-medium mb-3">Select API Key</label>
        <select
          value={selectedKeyId || ''}
          onChange={(e) => handleKeyChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">Choose an API key...</option>
          {apiKeys.map(key => (
            <option key={key.id} value={key.id}>
              {key.name} {key.isDefault ? '(Default)' : ''}
            </option>
          ))}
        </select>
      </Card>

      {selectedKeyId && (
        <>
          {/* Call Duration */}
          <Card className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Max Call Duration (seconds)</label>
              <Input
                type="number"
                min="30"
                max="3600"
                value={settings.maxCallDuration}
                onChange={(e) => setSettings({
                  ...settings,
                  maxCallDuration: parseInt(e.target.value) || 600
                })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum time a call can run (30 seconds to 1 hour)
              </p>
            </div>
          </Card>

          {/* Recording Settings */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">Recording Enabled</label>
                <p className="text-xs text-gray-500">Record all calls for playback and analysis</p>
              </div>
              <input
                type="checkbox"
                checked={settings.recordingEnabled}
                onChange={(e) => setSettings({
                  ...settings,
                  recordingEnabled: e.target.checked
                })}
                className="w-5 h-5"
              />
            </div>
          </Card>

          {/* Transcript Settings */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">Transcript Enabled</label>
                <p className="text-xs text-gray-500">Transcribe all calls for text analysis</p>
              </div>
              <input
                type="checkbox"
                checked={settings.transcriptEnabled}
                onChange={(e) => setSettings({
                  ...settings,
                  transcriptEnabled: e.target.checked
                })}
                className="w-5 h-5"
              />
            </div>
          </Card>

          {/* Webhook URL */}
          <Card className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Webhook URL (Optional)</label>
              <Input
                type="url"
                placeholder="https://yourdomain.com/api/vapi/webhooks/calls"
                value={settings.webhookUrl}
                onChange={(e) => setSettings({
                  ...settings,
                  webhookUrl: e.target.value
                })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Vapi will send real-time call events to this URL
              </p>
            </div>
          </Card>

          {/* Info Box */}
          <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Webhook Configuration</p>
              <p className="mt-1">
                To receive real-time call updates, configure your webhook URL in Vapi Dashboard and add it here.
                Vapi will send POST requests with call events.
              </p>
            </div>
          </Card>

          {/* Save Button */}
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </>
      )}

      {apiKeys.length === 0 && (
        <Card className="p-8 text-center text-gray-500 bg-gray-50">
          <p>No API keys configured</p>
          <p className="text-sm">Add an API key in the "API Keys" tab to configure settings</p>
        </Card>
      )}
    </div>
  )
}


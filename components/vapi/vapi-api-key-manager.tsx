'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Check, X, Loader } from 'lucide-react'
import { useVapiStore, type VapiApiKey } from '@/lib/stores/useVapiStore'
import { toast } from 'sonner'

export default function VapiApiKeyManager() {
  const { apiKeys, setApiKeys, setLoadingApiKeys, loadingApiKeys } = useVapiStore()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    defaultAssistantId: '',
    defaultPhoneNumber: '',
  })
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null)

  useEffect(() => {
    fetchApiKeys()
  }, [])

  const fetchApiKeys = async () => {
    try {
      setLoadingApiKeys(true)
      const response = await fetch('/api/vapi/keys')
      const data = await response.json()
      if (data.success) {
        setApiKeys(data.keys)
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
      toast.error('Failed to fetch API keys')
    } finally {
      setLoadingApiKeys(false)
    }
  }

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.apiKey) {
      toast.error('Name and API key are required')
      return
    }

    try {
      const response = await fetch('/api/vapi/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('API key added successfully')
        setFormData({ name: '', apiKey: '', defaultAssistantId: '', defaultPhoneNumber: '' })
        setShowForm(false)
        fetchApiKeys()
      } else {
        toast.error(data.error || 'Failed to add API key')
      }
    } catch (error) {
      console.error('Error adding API key:', error)
      toast.error('Failed to add API key')
    }
  }

  const handleTestKey = async (keyId: string) => {
    try {
      setTestingKeyId(keyId)
      const response = await fetch(`/api/vapi/keys/${keyId}/test`, {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        toast.success('API key is valid!')
        fetchApiKeys()
      } else {
        toast.error(data.message || 'API key test failed')
      }
    } catch (error) {
      console.error('Error testing API key:', error)
      toast.error('Failed to test API key')
    } finally {
      setTestingKeyId(null)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      const response = await fetch(`/api/vapi/keys/${keyId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        toast.success('API key deleted')
        fetchApiKeys()
      } else {
        toast.error('Failed to delete API key')
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Failed to delete API key')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">API Keys</h2>
          <p className="text-sm text-gray-600">Manage your Vapi.ai API keys</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add API Key
        </Button>
      </div>

      {/* Add Key Form */}
      {showForm && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <form onSubmit={handleAddKey} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Key Name</label>
              <Input
                placeholder="e.g., Production Key"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <Input
                type="password"
                placeholder="Paste your Vapi API key here"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Default Assistant ID</label>
                <Input
                  placeholder="Assistant ID (optional)"
                  value={formData.defaultAssistantId}
                  onChange={(e) => setFormData({ ...formData, defaultAssistantId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Default Phone Number</label>
                <Input
                  placeholder="Phone number ID (optional)"
                  value={formData.defaultPhoneNumber}
                  onChange={(e) => setFormData({ ...formData, defaultPhoneNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Save API Key
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* API Keys List */}
      <div className="space-y-3">
        {loadingApiKeys ? (
          <div className="text-center py-8 text-gray-500">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <p>No API keys configured yet</p>
            <p className="text-sm">Add your first Vapi API key to get started</p>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id} className="p-4 flex items-center justify-between hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{key.name}</h3>
                  {key.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>
                  )}
                  {key.testStatus === 'success' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid
                    </span>
                  )}
                  {key.testStatus === 'failed' && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded flex items-center gap-1">
                      <X className="w-3 h-3" /> Invalid
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestKey(key.id)}
                  disabled={testingKeyId === key.id}
                >
                  {testingKeyId === key.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    'Test'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteKey(key.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Mail, 
  Server, 
  Shield, 
  Settings, 
  Eye, 
  EyeOff,
  TestTube,
  Save,
  X
} from 'lucide-react'

interface EmailAccountEditProps {
  accountId: string
  onSuccess: () => void
  onCancel: () => void
}

interface EmailAccountData {
  id: string
  emailAddress: string
  displayName: string
  smtpHost: string
  smtpPort: number
  smtpEncryption: string
  smtpUsername: string
  smtpPassword: string
  imapHost: string | null
  imapPort: number | null
  imapEncryption: string | null
  imapUsername: string | null
  imapPassword: string | null
  signature: string | null
  isDefault: boolean
  status: string
  hasSmtpPassword: boolean
  hasImapPassword: boolean
}

const EMAIL_PRESETS = {
  gmail: {
    name: 'Gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpEncryption: 'TLS',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapEncryption: 'SSL',
  },
  outlook: {
    name: 'Outlook/Hotmail',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    smtpEncryption: 'TLS',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapEncryption: 'SSL',
  },
  yahoo: {
    name: 'Yahoo Mail',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpEncryption: 'TLS',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapEncryption: 'SSL',
  },
  custom: {
    name: 'Custom/Domain Email',
    smtpHost: '',
    smtpPort: 587,
    smtpEncryption: 'TLS',
    imapHost: '',
    imapPort: 993,
    imapEncryption: 'SSL',
  },
}

export function EmailAccountEdit({ accountId, onSuccess, onCancel }: EmailAccountEditProps) {
  const [formData, setFormData] = useState<Partial<EmailAccountData>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showImapPassword, setShowImapPassword] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const { toast } = useToast()

  useEffect(() => {
    loadAccountData()
  }, [accountId])

  const loadAccountData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/email/accounts/${accountId}`)
      if (response.ok) {
        const data = await response.json()
        setFormData(data.account)
        
        // Detect preset based on SMTP host
        const preset = Object.entries(EMAIL_PRESETS).find(([key, config]) => 
          config.smtpHost === data.account.smtpHost
        )
        setSelectedPreset(preset ? preset[0] : 'custom')
      } else {
        throw new Error('Failed to load account data')
      }
    } catch (error) {
      console.error('Error loading account data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load email account data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    if (preset !== 'custom' && EMAIL_PRESETS[preset as keyof typeof EMAIL_PRESETS]) {
      const config = EMAIL_PRESETS[preset as keyof typeof EMAIL_PRESETS]
      setFormData(prev => ({
        ...prev,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpEncryption: config.smtpEncryption,
        imapHost: config.imapHost,
        imapPort: config.imapPort,
        imapEncryption: config.imapEncryption,
      }))
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    try {
      // If passwords are masked, fetch the actual credentials from the server
      let testData = {
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        smtpEncryption: formData.smtpEncryption,
        smtpUsername: formData.smtpUsername,
        smtpPassword: formData.smtpPassword,
        imapHost: formData.imapHost,
        imapPort: formData.imapPort,
        imapEncryption: formData.imapEncryption,
        imapUsername: formData.imapUsername,
        imapPassword: formData.imapPassword,
      }

      // If passwords are masked, get the actual credentials
      if (formData.smtpPassword === '••••••••' || formData.imapPassword === '••••••••') {
        const credResponse = await fetch(`/api/email/accounts/${accountId}/credentials`)
        if (credResponse.ok) {
          const credData = await credResponse.json()
          if (credData.success) {
            // Use stored credentials for masked passwords
            if (formData.smtpPassword === '••••••••') {
              testData.smtpPassword = credData.credentials.smtpPassword
            }
            if (formData.imapPassword === '••••••••') {
              testData.imapPassword = credData.credentials.imapPassword
            }
          }
        }
      }

      const response = await fetch('/api/email/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Connection Test Successful',
          description: result.message || 'All connections tested successfully',
        })
      } else {
        toast({
          title: 'Connection Test Failed',
          description: result.error || 'Failed to test connection',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Connection Test Error',
        description: 'Failed to test email connection',
        variant: 'destructive',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch(`/api/email/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to update email account',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update email account',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading account data...</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Provider Preset */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="preset">Email Provider Preset</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select email provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook/Hotmail</SelectItem>
                  <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                  <SelectItem value="custom">Custom/Domain Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emailAddress">Email Address *</Label>
              <Input
                id="emailAddress"
                type="email"
                value={formData.emailAddress || ''}
                onChange={(e) => handleInputChange('emailAddress', e.target.value)}
                placeholder="your.email@domain.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={formData.displayName || ''}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="Your Name"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            SMTP Settings (Outgoing Mail)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="smtpHost">SMTP Server *</Label>
              <Input
                id="smtpHost"
                value={formData.smtpHost || ''}
                onChange={(e) => handleInputChange('smtpHost', e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="smtpPort">Port *</Label>
              <Input
                id="smtpPort"
                type="number"
                value={formData.smtpPort || ''}
                onChange={(e) => handleInputChange('smtpPort', e.target.value)}
                placeholder="587"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="smtpEncryption">Encryption *</Label>
              <Select 
                value={formData.smtpEncryption || ''} 
                onValueChange={(value) => handleInputChange('smtpEncryption', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select encryption" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TLS">TLS</SelectItem>
                  <SelectItem value="SSL">SSL</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="smtpUsername">Username *</Label>
              <Input
                id="smtpUsername"
                value={formData.smtpUsername || ''}
                onChange={(e) => handleInputChange('smtpUsername', e.target.value)}
                placeholder="Usually your email address"
                required
              />
            </div>
            <div>
              <Label htmlFor="smtpPassword">Password *</Label>
              <div className="relative">
                <Input
                  id="smtpPassword"
                  type={showSmtpPassword ? 'text' : 'password'}
                  value={formData.smtpPassword || ''}
                  onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
                  placeholder={formData.hasSmtpPassword ? '••••••••' : 'Enter password'}
                  required={!formData.hasSmtpPassword}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSmtpPassword(!showSmtpPassword);
                  }}
                  tabIndex={-1}
                >
                  {showSmtpPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IMAP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            IMAP Settings (Incoming Mail)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="imapHost">IMAP Server</Label>
              <Input
                id="imapHost"
                value={formData.imapHost || ''}
                onChange={(e) => handleInputChange('imapHost', e.target.value)}
                placeholder="imap.gmail.com"
              />
            </div>
            <div>
              <Label htmlFor="imapPort">Port</Label>
              <Input
                id="imapPort"
                type="number"
                value={formData.imapPort || ''}
                onChange={(e) => handleInputChange('imapPort', e.target.value)}
                placeholder="993"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="imapEncryption">Encryption</Label>
              <Select
                value={formData.imapEncryption || ''}
                onValueChange={(value) => handleInputChange('imapEncryption', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select encryption" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSL">SSL</SelectItem>
                  <SelectItem value="TLS">TLS</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="imapUsername">Username</Label>
              <Input
                id="imapUsername"
                value={formData.imapUsername || ''}
                onChange={(e) => handleInputChange('imapUsername', e.target.value)}
                placeholder="Usually your email address"
              />
            </div>
            <div>
              <Label htmlFor="imapPassword">Password</Label>
              <div className="relative">
                <Input
                  id="imapPassword"
                  type={showImapPassword ? 'text' : 'password'}
                  value={formData.imapPassword || ''}
                  onChange={(e) => handleInputChange('imapPassword', e.target.value)}
                  placeholder={formData.hasImapPassword ? '••••••••' : 'Enter password'}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowImapPassword(!showImapPassword);
                  }}
                  tabIndex={-1}
                >
                  {showImapPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="signature">Email Signature</Label>
            <Textarea
              id="signature"
              value={formData.signature || ''}
              onChange={(e) => handleInputChange('signature', e.target.value)}
              placeholder="Best regards,&#10;Your Name&#10;Your Company"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={formData.isDefault || false}
              onCheckedChange={(checked) => handleInputChange('isDefault', checked)}
            />
            <Label htmlFor="isDefault">Set as default email account</Label>
          </div>

          <div>
            <Label htmlFor="status">Account Status</Label>
            <Select
              value={formData.status || 'active'}
              onValueChange={(value) => handleInputChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={isTesting}
        >
          <TestTube className="h-4 w-4 mr-2" />
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Button>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}

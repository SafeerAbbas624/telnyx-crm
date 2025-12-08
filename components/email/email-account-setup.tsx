"use client"

import { useState } from "react"
import dynamic from 'next/dynamic'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Mail, Settings, TestTube, ArrowLeft, CheckCircle, XCircle, Eye, EyeOff, Loader2 } from "lucide-react"

// Dynamic import for rich text editor (client-only)
const RichTextEditor = dynamic(() => import('./rich-text-editor'), { ssr: false })

interface EmailAccountSetupProps {
  onSuccess: () => void
  onCancel: () => void
}

interface EmailAccountForm {
  emailAddress: string
  displayName: string
  smtpHost: string
  smtpPort: number
  smtpEncryption: 'SSL' | 'TLS' | 'NONE'
  smtpUsername: string
  smtpPassword: string
  imapHost: string
  imapPort: number
  imapEncryption: 'SSL' | 'TLS' | 'NONE'
  imapUsername: string
  imapPassword: string
  signature: string
  isDefault: boolean
}

const EMAIL_PRESETS = {
  gmail: {
    name: 'Gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpEncryption: 'TLS' as const,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapEncryption: 'SSL' as const,
  },
  outlook: {
    name: 'Outlook/Hotmail',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    smtpEncryption: 'TLS' as const,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapEncryption: 'SSL' as const,
  },
  yahoo: {
    name: 'Yahoo Mail',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpEncryption: 'TLS' as const,
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapEncryption: 'SSL' as const,
  },
  custom: {
    name: 'Custom/Domain Email',
    smtpHost: '',
    smtpPort: 587,
    smtpEncryption: 'TLS' as const,
    imapHost: '',
    imapPort: 993,
    imapEncryption: 'SSL' as const,
  },
  hostinger: {
    name: 'Hostinger',
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 465,
    smtpEncryption: 'SSL' as const,
    imapHost: 'imap.hostinger.com',
    imapPort: 993,
    imapEncryption: 'SSL' as const,
  },
}

export default function EmailAccountSetup({ onSuccess, onCancel }: EmailAccountSetupProps) {
  const { toast } = useToast()
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof EMAIL_PRESETS>('hostinger')
  const [isLoading, setIsLoading] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [imapStatus, setImapStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showImapPassword, setShowImapPassword] = useState(false)

  // Common email provider presets
  const emailProviders = {
    gmail: {
      name: 'Gmail',
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      smtpEncryption: 'TLS',
      imapHost: 'imap.gmail.com',
      imapPort: '993',
      imapEncryption: 'SSL',
    },
    outlook: {
      name: 'Outlook/Hotmail',
      smtpHost: 'smtp-mail.outlook.com',
      smtpPort: '587',
      smtpEncryption: 'TLS',
      imapHost: 'outlook.office365.com',
      imapPort: '993',
      imapEncryption: 'SSL',
    },
    yahoo: {
      name: 'Yahoo',
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: '587',
      smtpEncryption: 'TLS',
      imapHost: 'imap.mail.yahoo.com',
      imapPort: '993',
      imapEncryption: 'SSL',
    }
  }

  // Default to Hostinger settings
  const [formData, setFormData] = useState<EmailAccountForm>({
    emailAddress: '',
    displayName: '',
    smtpHost: EMAIL_PRESETS.hostinger.smtpHost,
    smtpPort: EMAIL_PRESETS.hostinger.smtpPort,
    smtpEncryption: EMAIL_PRESETS.hostinger.smtpEncryption,
    smtpUsername: '',
    smtpPassword: '',
    imapHost: EMAIL_PRESETS.hostinger.imapHost,
    imapPort: EMAIL_PRESETS.hostinger.imapPort,
    imapEncryption: EMAIL_PRESETS.hostinger.imapEncryption,
    imapUsername: '',
    imapPassword: '',
    signature: '',
    isDefault: false,
  })

  const handlePresetChange = (preset: keyof typeof EMAIL_PRESETS) => {
    setSelectedPreset(preset)
    const presetData = EMAIL_PRESETS[preset]
    setFormData(prev => ({
      ...prev,
      smtpHost: presetData.smtpHost,
      smtpPort: presetData.smtpPort,
      smtpEncryption: presetData.smtpEncryption,
      imapHost: presetData.imapHost,
      imapPort: presetData.imapPort,
      imapEncryption: presetData.imapEncryption,
    }))
  }

  const handleInputChange = (field: keyof EmailAccountForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Auto-fill username fields if email changes
    if (field === 'emailAddress') {
      setFormData(prev => ({
        ...prev,
        smtpUsername: value,
        imapUsername: value,
      }))
    }
  }

  const handleProviderSelect = (providerId: string) => {
    if (providerId === 'custom') return

    const provider = emailProviders[providerId as keyof typeof emailProviders]
    if (provider) {
      setFormData(prev => ({
        ...prev,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        smtpEncryption: provider.smtpEncryption,
        imapHost: provider.imapHost,
        imapPort: provider.imapPort,
        imapEncryption: provider.imapEncryption,
      }))
      setTestStatus('idle')
      setTestMessage('')
    }
  }

  const testConnection = async () => {
    setIsLoading(true)
    setTestStatus('testing')
    setSmtpStatus('testing')
    setImapStatus('testing')
    setTestMessage('')

    try {
      const response = await fetch('/api/email/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })

      const result = await response.json()

      // Update individual statuses
      if (result.results) {
        setSmtpStatus(result.results.smtp?.success ? 'success' : 'error')
        setImapStatus(result.results.imap?.success ? 'success' : 'error')
      }

      if (response.ok && result.success) {
        setTestStatus('success')
        setTestMessage(result.message || 'Connection successful!')
      } else {
        setTestStatus('error')
        let errorMessage = result.message || result.error || 'Connection failed. Please check your settings.'

        // Add specific error details if available
        if (result.details) {
          if (result.details.smtpError) {
            errorMessage += `\n\nSMTP Error: ${result.details.smtpError}`
          }
          if (result.details.imapError) {
            errorMessage += `\n\nIMAP Error: ${result.details.imapError}`
          }
        }

        setTestMessage(errorMessage)
      }
    } catch (error) {
      setTestStatus('error')
      setSmtpStatus('error')
      setImapStatus('error')
      setTestMessage('Failed to test connection. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/email/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.message || 'Failed to add email account',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add email account',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Mail className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Add Email Account</h1>
            <p className="text-sm text-muted-foreground">
              Configure your email account for sending and receiving emails
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          {/* Email Provider Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Email Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(EMAIL_PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={selectedPreset === key ? "default" : "outline"}
                    className="h-auto p-3 flex flex-col items-center gap-2"
                    onClick={() => handlePresetChange(key as keyof typeof EMAIL_PRESETS)}
                  >
                    <Mail className="h-5 w-5" />
                    <span className="text-xs">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emailAddress">Email Address *</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={formData.emailAddress}
                    onChange={(e) => handleInputChange('emailAddress', e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Display Name *</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    placeholder="Your Name"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Provider Presets */}
          <Card>
            <CardHeader>
              <CardTitle>Email Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Quick Setup</Label>
                <Select onValueChange={handleProviderSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your email provider for automatic configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="outlook">Outlook/Hotmail</SelectItem>
                    <SelectItem value="yahoo">Yahoo</SelectItem>
                    <SelectItem value="hostinger">Hostinger</SelectItem>
                    <SelectItem value="custom">Custom Configuration</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select your email provider to automatically fill in the correct server settings.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SMTP & IMAP Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Server Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="smtp" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="smtp">SMTP (Outgoing)</TabsTrigger>
                  <TabsTrigger value="imap">IMAP (Incoming)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="smtp" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="smtpHost">SMTP Host *</Label>
                      <Input
                        id="smtpHost"
                        value={formData.smtpHost}
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
                        value={formData.smtpPort}
                        onChange={(e) => handleInputChange('smtpPort', parseInt(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="smtpEncryption">Encryption *</Label>
                      <Select
                        value={formData.smtpEncryption}
                        onValueChange={(value) => handleInputChange('smtpEncryption', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SSL">SSL</SelectItem>
                          <SelectItem value="TLS">TLS</SelectItem>
                          <SelectItem value="NONE">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="smtpUsername">Username *</Label>
                      <Input
                        id="smtpUsername"
                        value={formData.smtpUsername}
                        onChange={(e) => handleInputChange('smtpUsername', e.target.value)}
                        placeholder="Usually your email"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtpPassword">Password *</Label>
                      <div className="relative">
                        <Input
                          id="smtpPassword"
                          type={showSmtpPassword ? 'text' : 'password'}
                          value={formData.smtpPassword}
                          onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
                          placeholder="App password recommended"
                          required
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
                </TabsContent>
                
                <TabsContent value="imap" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="imapHost">IMAP Host</Label>
                      <Input
                        id="imapHost"
                        value={formData.imapHost}
                        onChange={(e) => handleInputChange('imapHost', e.target.value)}
                        placeholder="imap.gmail.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imapPort">Port</Label>
                      <Input
                        id="imapPort"
                        type="number"
                        value={formData.imapPort}
                        onChange={(e) => handleInputChange('imapPort', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="imapEncryption">Encryption</Label>
                      <Select
                        value={formData.imapEncryption}
                        onValueChange={(value) => handleInputChange('imapEncryption', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SSL">SSL</SelectItem>
                          <SelectItem value="TLS">TLS</SelectItem>
                          <SelectItem value="NONE">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="imapUsername">Username</Label>
                      <Input
                        id="imapUsername"
                        value={formData.imapUsername}
                        onChange={(e) => handleInputChange('imapUsername', e.target.value)}
                        placeholder="Usually your email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imapPassword">Password</Label>
                      <div className="relative">
                        <Input
                          id="imapPassword"
                          type={showImapPassword ? 'text' : 'password'}
                          value={formData.imapPassword}
                          onChange={(e) => handleInputChange('imapPassword', e.target.value)}
                          placeholder="App password recommended"
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Additional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="signature" className="mb-2 block">Email Signature</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Use the toolbar to add bold, italic, links, and more
                </p>
                <RichTextEditor
                  content={formData.signature}
                  onChange={(html) => handleInputChange('signature', html)}
                  placeholder="Best regards,&#10;Your Name&#10;Your Company"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => handleInputChange('isDefault', checked)}
                />
                <Label htmlFor="isDefault">Set as default email account</Label>
              </div>
            </CardContent>
          </Card>

          {/* Test Connection */}
          <Card>
            <CardHeader>
              <CardTitle>Test Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={isLoading || !formData.emailAddress || !formData.smtpHost || !formData.smtpPassword}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  {isLoading ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>

              {/* Separate SMTP and IMAP status indicators */}
              {testStatus !== 'idle' && (
                <div className="grid grid-cols-2 gap-4">
                  {/* SMTP Status */}
                  <div className={`p-3 rounded-lg border ${
                    smtpStatus === 'success' ? 'bg-green-50 border-green-200' :
                    smtpStatus === 'error' ? 'bg-red-50 border-red-200' :
                    smtpStatus === 'testing' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {smtpStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                      {smtpStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {smtpStatus === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                      <span className="font-medium text-sm">SMTP (Outgoing)</span>
                    </div>
                    <p className={`text-xs mt-1 ${
                      smtpStatus === 'success' ? 'text-green-700' :
                      smtpStatus === 'error' ? 'text-red-700' :
                      smtpStatus === 'testing' ? 'text-blue-700' :
                      'text-gray-600'
                    }`}>
                      {smtpStatus === 'testing' ? 'Testing send capability...' :
                       smtpStatus === 'success' ? '✓ Can send emails' :
                       smtpStatus === 'error' ? '✗ Cannot send emails' : 'Not tested'}
                    </p>
                  </div>

                  {/* IMAP Status */}
                  <div className={`p-3 rounded-lg border ${
                    imapStatus === 'success' ? 'bg-green-50 border-green-200' :
                    imapStatus === 'error' ? 'bg-yellow-50 border-yellow-200' :
                    imapStatus === 'testing' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {imapStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                      {imapStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {imapStatus === 'error' && <XCircle className="h-4 w-4 text-yellow-600" />}
                      <span className="font-medium text-sm">IMAP (Incoming)</span>
                    </div>
                    <p className={`text-xs mt-1 ${
                      imapStatus === 'success' ? 'text-green-700' :
                      imapStatus === 'error' ? 'text-yellow-700' :
                      imapStatus === 'testing' ? 'text-blue-700' :
                      'text-gray-600'
                    }`}>
                      {imapStatus === 'testing' ? 'Testing receive capability...' :
                       imapStatus === 'success' ? '✓ Can receive emails' :
                       imapStatus === 'error' ? '⚠ Cannot receive (optional)' : 'Not tested'}
                    </p>
                  </div>
                </div>
              )}

              {testMessage && (
                <div className={`text-sm p-3 rounded border ${
                  testStatus === 'success'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{testMessage}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding Account...' : 'Add Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

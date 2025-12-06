"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Play, Pause, Trash2, Search, Phone, Users, Clock, PhoneCall, AlertTriangle, Edit } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface CallCampaign {
  id: string
  name: string
  description: string | null
  status: string
  totalContacts: number
  contactsCalled: number
  contactsAnswered: number
  contactsNoAnswer: number
  totalTalkTime: number
  dispositions: string[]
  senderNumbers: any[]
  scriptId: string | null
  script: { id: string; name: string } | null
  createdAt: string
  startedAt: string | null
  _count?: { contacts: number }
}

interface CallScript {
  id: string
  name: string
}

interface PhoneNumber {
  id: string
  phoneNumber: string
  friendlyName: string | null
}

export default function CallCampaignList() {
  const [campaigns, setCampaigns] = useState<CallCampaign[]>([])
  const [scripts, setScripts] = useState<CallScript[]>([])
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [warningDialogOpen, setWarningDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<CallCampaign | null>(null)
  const [campaignToStart, setCampaignToStart] = useState<CallCampaign | null>(null)
  const [runningCampaignInfo, setRunningCampaignInfo] = useState<{ id: string; name: string } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scriptId: "",
    selectedNumbers: [] as string[],
    dispositions: ["Interested", "Not Interested", "Callback", "Wrong Number", "No Answer", "Voicemail", "Do Not Call"]
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCampaigns()
    fetchScripts()
    fetchPhoneNumbers()
    const interval = setInterval(fetchCampaigns, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/call-campaigns')
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchScripts = async () => {
    try {
      const res = await fetch('/api/call-scripts?activeOnly=true')
      const data = await res.json()
      if (data.scripts) setScripts(data.scripts)
    } catch (error) {
      console.error('Failed to load scripts:', error)
    }
  }

  const fetchPhoneNumbers = async () => {
    try {
      const res = await fetch('/api/telnyx/phone-numbers')
      const data = await res.json()
      if (data.phoneNumbers) setPhoneNumbers(data.phoneNumbers)
    } catch (error) {
      console.error('Failed to load phone numbers:', error)
    }
  }

  const handleCreate = () => {
    setFormData({
      name: "",
      description: "",
      scriptId: "",
      selectedNumbers: [],
      dispositions: ["Interested", "Not Interested", "Callback", "Wrong Number", "No Answer", "Voicemail", "Do Not Call"]
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (formData.selectedNumbers.length === 0) {
      toast.error('Select at least one phone number')
      return
    }
    setSaving(true)
    try {
      const senderNumbers = formData.selectedNumbers.map(id => {
        const phone = phoneNumbers.find(p => p.id === id)
        return { id, phoneNumber: phone?.phoneNumber, friendlyName: phone?.friendlyName }
      })
      const res = await fetch('/api/call-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          scriptId: formData.scriptId || null,
          senderNumbers,
          dispositions: formData.dispositions,
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      toast.success('Campaign created')
      setDialogOpen(false)
      fetchCampaigns()
    } catch (error) {
      toast.error('Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async (campaign: CallCampaign, forceStart = false) => {
    try {
      const res = await fetch(`/api/call-campaigns/${campaign.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceStart }),
      })
      const data = await res.json()
      if (res.status === 409 && data.requiresConfirmation) {
        setCampaignToStart(campaign)
        setRunningCampaignInfo(data.runningCampaign)
        setWarningDialogOpen(true)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      toast.success('Campaign started')
      fetchCampaigns()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handlePause = async (campaign: CallCampaign) => {
    try {
      const res = await fetch(`/api/call-campaigns/${campaign.id}/pause`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to pause')
      toast.success('Campaign paused')
      fetchCampaigns()
    } catch (error) {
      toast.error('Failed to pause campaign')
    }
  }

  const handleDelete = (campaign: CallCampaign) => {
    setCampaignToDelete(campaign)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!campaignToDelete) return
    try {
      const res = await fetch(`/api/call-campaigns/${campaignToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Campaign deleted')
      fetchCampaigns()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setDeleteDialogOpen(false)
      setCampaignToDelete(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending: { variant: "outline", label: "Pending" },
      running: { variant: "default", label: "Running" },
      paused: { variant: "secondary", label: "Paused" },
      completed: { variant: "outline", label: "Completed" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    }
    const config = variants[status] || { variant: "secondary", label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) return `${hrs}h ${mins}m`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5" />
                Call Campaigns
              </CardTitle>
              <CardDescription>Manage your autodialer campaigns</CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No campaigns match your search' : 'No campaigns yet. Create your first campaign!'}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredCampaigns.map((campaign) => {
                  const progress = campaign.totalContacts > 0
                    ? (campaign.contactsCalled / campaign.totalContacts) * 100
                    : 0
                  return (
                    <div key={campaign.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{campaign.name}</h3>
                            {getStatusBadge(campaign.status)}
                          </div>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground">{campaign.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {campaign.totalContacts} contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {campaign.contactsCalled} called
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatDuration(campaign.totalTalkTime)}
                            </span>
                          </div>
                          {campaign.totalContacts > 0 && (
                            <div className="mt-2">
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {Math.round(progress)}% complete
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          {campaign.status === 'running' ? (
                            <Button variant="outline" size="sm" onClick={() => handlePause(campaign)}>
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                          ) : campaign.status !== 'completed' && campaign.status !== 'cancelled' && (
                            <Button variant="outline" size="sm" onClick={() => handleStart(campaign)} disabled={campaign.totalContacts === 0}>
                              <Play className="h-4 w-4 mr-1" />
                              {campaign.status === 'paused' ? 'Resume' : 'Start'}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(campaign)} className="text-red-500 hover:text-red-600" disabled={campaign.status === 'running'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>Create a new call campaign. You can add contacts after creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., January Cold Calls"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this campaign"
                rows={2}
              />
            </div>
            <div>
              <Label>Call Script (optional)</Label>
              <Select value={formData.scriptId || "none"} onValueChange={(v) => setFormData({ ...formData, scriptId: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a script" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No script</SelectItem>
                  {scripts.map((script) => (
                    <SelectItem key={script.id} value={script.id}>{script.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone Numbers</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                {phoneNumbers.map((phone) => (
                  <label key={phone.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1 rounded">
                    <input
                      type="checkbox"
                      checked={formData.selectedNumbers.includes(phone.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, selectedNumbers: [...formData.selectedNumbers, phone.id] })
                        } else {
                          setFormData({ ...formData, selectedNumbers: formData.selectedNumbers.filter(id => id !== phone.id) })
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{phone.friendlyName || phone.phoneNumber}</span>
                    {phone.friendlyName && <span className="text-xs text-muted-foreground">{phone.phoneNumber}</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaignToDelete?.name}"? This will also remove all contacts from the campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Double Campaign Warning */}
      <AlertDialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Another Campaign is Running
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{runningCampaignInfo?.name}"</strong> is currently running.
              Starting another campaign may cause issues. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setWarningDialogOpen(false); setCampaignToStart(null); setRunningCampaignInfo(null) }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setWarningDialogOpen(false); if (campaignToStart) handleStart(campaignToStart, true) }}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Start Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


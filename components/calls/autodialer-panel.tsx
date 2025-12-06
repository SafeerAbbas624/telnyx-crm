"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Phone, PhoneOff, User, MapPin, FileText, Clock, CheckCircle, XCircle, SkipForward, PhoneCall, Pause, Play, Users } from "lucide-react"
import { toast } from "sonner"

interface Contact {
  id: string
  firstName: string | null
  lastName: string | null
  phone1: string | null
  phone2: string | null
  propertyAddress: string | null
  city: string | null
  state: string | null
}

interface CampaignContact {
  id: string
  contactId: string
  status: string
  disposition: string | null
  notes: string | null
  attemptCount: number
  contact: Contact
}

interface Campaign {
  id: string
  name: string
  status: string
  dispositions: string[]
  script: { id: string; name: string; content: string; variables: string[] } | null
  contacts: CampaignContact[]
  totalContacts: number
  contactsCalled: number
}

export default function AutodialerPanel() {
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: string }[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("")
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [currentContact, setCurrentContact] = useState<CampaignContact | null>(null)
  const [isDialing, setIsDialing] = useState(false)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  useEffect(() => {
    if (selectedCampaignId) {
      fetchCampaignDetails(selectedCampaignId)
    }
  }, [selectedCampaignId])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isDialing && callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime.getTime()) / 1000))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isDialing, callStartTime])

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/call-campaigns')
      const data = await res.json()
      if (data.campaigns) {
        setCampaigns(data.campaigns.filter((c: any) => c.status === 'running' || c.status === 'paused'))
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCampaignDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/call-campaigns/${id}`)
      const data = await res.json()
      if (data.campaign) {
        setCampaign(data.campaign)
        // Find next pending contact
        const nextContact = data.campaign.contacts.find((c: CampaignContact) => c.status === 'pending')
        setCurrentContact(nextContact || null)
      }
    } catch (error) {
      toast.error('Failed to load campaign details')
    }
  }

  const startCall = () => {
    if (!currentContact) return
    setIsDialing(true)
    setCallStartTime(new Date())
    setCallDuration(0)
    toast.info(`Calling ${currentContact.contact.firstName || 'Contact'}...`)
  }

  const endCall = () => {
    setIsDialing(false)
    toast.info('Call ended. Select a disposition.')
  }

  const setDisposition = async (disposition: string) => {
    if (!campaign || !currentContact) return
    try {
      const res = await fetch(`/api/call-campaigns/${campaign.id}/disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: currentContact.contactId,
          disposition,
          notes,
          callDuration,
        }),
      })
      if (!res.ok) throw new Error('Failed to set disposition')
      toast.success(`Marked as: ${disposition}`)
      setNotes("")
      setCallDuration(0)
      setCallStartTime(null)
      setIsDialing(false)
      // Refresh campaign to get next contact
      fetchCampaignDetails(campaign.id)
    } catch (error) {
      toast.error('Failed to save disposition')
    }
  }

  const skipContact = () => setDisposition('Skip')

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const replaceVariables = (content: string, contact: Contact) => {
    return content
      .replace(/\{firstName\}/g, contact.firstName || '')
      .replace(/\{lastName\}/g, contact.lastName || '')
      .replace(/\{propertyAddress\}/g, contact.propertyAddress || '')
      .replace(/\{city\}/g, contact.city || '')
      .replace(/\{state\}/g, contact.state || '')
  }

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading autodialer...</div>
  }

  if (campaigns.length === 0) {
    return (
      <div className="p-6 text-center">
        <PhoneCall className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Active Campaigns</h2>
        <p className="text-muted-foreground">Start a campaign from the Call Campaigns page to begin dialing.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Campaign Selector */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campaign && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {campaign.contactsCalled}/{campaign.totalContacts} called
              </span>
              <Badge variant={campaign.status === 'running' ? 'default' : 'secondary'}>
                {campaign.status}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {!campaign ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a campaign to start dialing
        </div>
      ) : !currentContact ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">All Contacts Called!</h2>
            <p className="text-muted-foreground">You've reached all contacts in this campaign.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Contact Info & Dialer */}
          <div className="w-1/3 border-r flex flex-col">
            {/* Contact Card */}
            <Card className="m-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {currentContact.contact.firstName} {currentContact.contact.lastName}
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {currentContact.contact.propertyAddress}, {currentContact.contact.city}, {currentContact.contact.state}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{currentContact.contact.phone1}</span>
                  </div>
                  {currentContact.contact.phone2 && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{currentContact.contact.phone2}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Attempt #{currentContact.attemptCount + 1}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dialer Controls */}
            <div className="p-4 space-y-4">
              {isDialing ? (
                <>
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-green-500">{formatDuration(callDuration)}</div>
                    <p className="text-sm text-muted-foreground">Call in progress</p>
                  </div>
                  <Button onClick={endCall} variant="destructive" className="w-full" size="lg">
                    <PhoneOff className="h-5 w-5 mr-2" />
                    End Call
                  </Button>
                </>
              ) : (
                <Button onClick={startCall} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                  <Phone className="h-5 w-5 mr-2" />
                  Start Call
                </Button>
              )}
              <Button onClick={skipContact} variant="outline" className="w-full" disabled={isDialing}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip Contact
              </Button>
            </div>

            {/* Notes */}
            <div className="p-4 flex-1">
              <label className="text-sm font-medium mb-2 block">Call Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this call..."
                className="h-32"
              />
            </div>
          </div>

          {/* Middle Panel - Script */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {campaign.script?.name || 'No Script'}
              </h3>
            </div>
            <ScrollArea className="flex-1 p-4">
              {campaign.script ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {replaceVariables(campaign.script.content, currentContact.contact)}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No script assigned to this campaign</p>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel - Dispositions */}
          <div className="w-64 border-l flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <h3 className="font-semibold">Disposition</h3>
              <p className="text-xs text-muted-foreground">Select outcome after call</p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {(campaign.dispositions as string[]).map((disp) => (
                  <Button
                    key={disp}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setDisposition(disp)}
                    disabled={isDialing}
                  >
                    {disp === 'Interested' && <CheckCircle className="h-4 w-4 mr-2 text-green-500" />}
                    {disp === 'Not Interested' && <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                    {disp === 'Callback' && <Clock className="h-4 w-4 mr-2 text-yellow-500" />}
                    {disp === 'Do Not Call' && <PhoneOff className="h-4 w-4 mr-2 text-red-500" />}
                    {disp}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}

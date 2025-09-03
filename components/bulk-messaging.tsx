"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Send, Check, AlertCircle, Phone, Pause, Play, Trash2 } from "lucide-react"
import { mockContacts } from "@/lib/mock-contacts"
import { mockTemplates } from "@/lib/mock-templates"
import type { Contact } from "@/lib/types"
import { useProcesses } from "@/lib/context/process-context"

export default function BulkMessaging() {
  const [contacts, setContacts] = useState(mockContacts)
  const [templates, setTemplates] = useState(mockTemplates)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const [senderNumbers, setSenderNumbers] = useState<string[]>([
    "+17867458508",
    "+19548720835",
    "+13054885278",
    "+17868404856",
    "+13054885284",
    "+15615714429",
  ])
  const [newSenderNumber, setNewSenderNumber] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [delayMin, setDelayMin] = useState(8)
  const [delayMax, setDelayMax] = useState(12)
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const { toast } = useToast()
  const { addProcess, updateProcess, pauseProcess, resumeProcess } = useProcesses()

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      !searchQuery ||
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchLower) ||
      contact.phone1?.includes(searchLower) ||
      contact.propertyAddress?.toLowerCase().includes(searchLower)
    )
  })

  const toggleContactSelection = (contactId: string) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter((id) => id !== contactId))
    } else {
      setSelectedContacts([...selectedContacts, contactId])
    }
  }

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map((contact) => contact.id))
    }
  }

  const addSenderNumber = () => {
    if (newSenderNumber.trim() && !senderNumbers.includes(newSenderNumber.trim())) {
      setSenderNumbers([...senderNumbers, newSenderNumber.trim()])
      setNewSenderNumber("")
    }
  }

  const removeSenderNumber = (number: string) => {
    setSenderNumbers(senderNumbers.filter((n) => n !== number))
  }

  const getSelectedContactsCount = () => {
    return selectedContacts.length
  }

  const getSelectedTemplate = () => {
    return templates.find((t) => t.id === selectedTemplate)
  }

  const formatMessage = (template: string, contact: Contact) => {
    let message = template
    message = message.replace(/\{first_name\}/g, contact.firstName || "")
    message = message.replace(/\{last_name\}/g, contact.lastName || "")
    message = message.replace(/\{property_address\}/g, contact.propertyAddress || "")
    return message
  }

  const startSending = async () => {
    if (selectedContacts.length === 0 || !selectedTemplate) {
      toast({
        title: "Cannot send messages",
        description: "Please select contacts and a message template",
        variant: "destructive",
      })
      return
    }

    if (senderNumbers.length === 0) {
      toast({
        title: "No sender numbers",
        description: "Please add at least one sender phone number",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setIsPaused(false)
    setSentCount(0)
    setProgress(0)

    const selectedContactsData = contacts.filter((c) => selectedContacts.includes(c.id))
    const totalMessages = selectedContactsData.length

    const newProcess = {
      id: `proc_${Date.now()}`,
      name: `Text Blast: ${getSelectedTemplate()?.name}`,
      status: "running" as const,
      progress: 0,
      total: totalMessages,
      isPaused: false,
      label: `Text Blast (${totalMessages} contacts)`,
      type: "text" as const,
      payload: {
        contacts: selectedContactsData,
        template: getSelectedTemplate(),
      },
    }

    addProcess(newProcess)
    const procId = newProcess.id
    setCurrentProcessId(procId)

    for (let i = 0; i < totalMessages; i++) {
      if (isPaused) {
        await new Promise<void>((resolve) => {
          const checkPaused = () => {
            if (!isPaused) {
              resolve()
            } else {
              setTimeout(checkPaused, 1000)
            }
          }
          checkPaused()
        })
      }

      const contact = selectedContactsData[i]
      const senderNumber = senderNumbers[i % senderNumbers.length]
      const template = getSelectedTemplate()

      if (template) {
        const message = formatMessage(template.content, contact)
        console.log(`Sending to ${contact.firstName}: "${message}" from ${senderNumber}`)
        // Simulate API call
      }

      const currentProgress = ((i + 1) / totalMessages) * 100
      setSentCount(i + 1)
      setProgress(currentProgress)

      updateProcess(procId, { progress: i + 1 })

      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin)
      await new Promise((resolve) => setTimeout(resolve, delay * 1000))
    }

    setIsSending(false)

    toast({
      title: "Bulk messaging complete",
      description: `Successfully sent ${selectedContactsData.length} messages`,
    })
  }

  const pauseSending = () => {
    setIsPaused(true)
    if (currentProcessId) {
      pauseProcess(currentProcessId)
      toast({
        title: "Text Blast Paused",
        description: "Message sending has been paused",
      })
    }
  }

  const resumeSending = () => {
    setIsPaused(false)
    if (currentProcessId) {
      resumeProcess(currentProcessId)
      toast({
        title: "Text Blast Resumed",
        description: "Message sending has been resumed",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Bulk Messaging</h2>
        <p className="text-muted-foreground mb-4">Send messages to multiple contacts using rotating phone numbers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Select Contacts ({filteredContacts.length})</h3>
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedContacts.length === filteredContacts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-1 gap-2 pr-4">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => toggleContactSelection(contact.id)}
                    >
                      <Checkbox checked={selectedContacts.includes(contact.id)} className="mr-3" />
                      <div className="flex-1">
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">{contact.phone1}</p>
                        <p className="text-xs text-muted-foreground">{contact.propertyAddress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">Select Message Template</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3 pr-4">
                  {templates.map((template) => (
                    <Card
                      key={template.id}
                      className={`p-4 cursor-pointer transition-all ${selectedTemplate === template.id ? "ring-2 ring-primary" : "hover:bg-muted"}`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{template.name}</h4>
                        {selectedTemplate === template.id && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{template.content}</p>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">Sender Phone Numbers</h3>
              <div className="space-y-2">
                {senderNumbers.map((number) => (
                  <div key={number} className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                    <span className="text-sm font-mono flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {number}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeSenderNumber(number)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="+1..."
                  value={newSenderNumber}
                  onChange={(e) => setNewSenderNumber(e.target.value)}
                />
                <Button onClick={addSenderNumber}>Add</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">Sending Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delay-min">Min Delay (s)</Label>
                  <Input
                    id="delay-min"
                    type="number"
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number.parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="delay-max">Max Delay (s)</Label>
                  <Input
                    id="delay-max"
                    type="number"
                    value={delayMax}
                    onChange={(e) => setDelayMax(Number.parseInt(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A random delay between {delayMin} and {delayMax} seconds will be applied between messages to avoid rate
                limits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">Messaging Summary</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Selected Contacts:</span>
                  <span className="font-medium">{getSelectedContactsCount()}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm">Template:</span>
                  <span className="font-medium">{getSelectedTemplate()?.name || "None"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm">Sender Numbers:</span>
                  <span className="font-medium">{senderNumbers.length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm">Estimated Time:</span>
                  <span className="font-medium">
                    {getSelectedContactsCount() > 0
                      ? `~${Math.ceil((getSelectedContactsCount() * ((delayMin + delayMax) / 2)) / 60)} minutes`
                      : "N/A"}
                  </span>
                </div>
              </div>

              {isSending && (
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress:</span>
                    <span>
                      {sentCount} of {getSelectedContactsCount()}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {isSending ? (
                <div className="flex gap-2">
                  {isPaused ? (
                    <Button onClick={resumeSending} className="flex-1 flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Resume Sending
                    </Button>
                  ) : (
                    <Button onClick={pauseSending} className="flex-1 flex items-center gap-2">
                      <Pause className="h-4 w-4" />
                      Pause Sending
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={startSending}
                  className="w-full flex items-center gap-2"
                  disabled={getSelectedContactsCount() === 0 || !selectedTemplate || senderNumbers.length === 0}
                >
                  <Send className="h-4 w-4" />
                  Start Sending Messages
                </Button>
              )}

              {(getSelectedContactsCount() === 0 || !selectedTemplate || senderNumbers.length === 0) && (
                <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Cannot send messages</p>
                    <ul className="list-disc list-inside mt-1 text-xs">
                      {getSelectedContactsCount() === 0 && <li>Select at least one contact</li>}
                      {!selectedTemplate && <li>Select a message template</li>}
                      {senderNumbers.length === 0 && <li>Add at least one sender phone number</li>}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"

import React, { useState, useEffect } from "react"
import type { Contact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Send, Users, X, Play, Pause, Phone, Plus, Edit, Trash2, Copy, Save } from "lucide-react"
import { useProcesses } from "@/lib/context/process-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useContacts } from "@/lib/context/contacts-context"
import AdvancedContactFilter from "@/components/text/advanced-contact-filter"
import { getBestPhoneNumber, formatPhoneNumberForDisplay } from "@/lib/phone-utils"

interface Template {
  id: string
  name: string
  content: string
  variables: string[]
  subject?: string
}


export default function TextBlast() {
  const { contacts, searchContacts, pagination } = useContacts()
  const [message, setMessage] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>(contacts)
  const [senderNumbers, setSenderNumbers] = useState<any[]>([]);
  const [newSenderNumber, setNewSenderNumber] = useState("");
  const [newSenderState, setNewSenderState] = useState("");
  const [showAddNumberDialog, setShowAddNumberDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [delayMin, setDelayMin] = useState(8);
  const [delayMax, setDelayMax] = useState(12);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("")
  const [templateContent, setTemplateContent] = useState("")
  const [activeTemplateTab, setActiveTemplateTab] = useState("select")

  const { toast } = useToast();
  const { addProcess, updateProcess, pauseProcess, resumeProcess } = useProcesses();

  // Fetch user's allowed phone numbers (respects permissions)
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Fetch user's allowed phone numbers (respects permissions)
        try {
          const phoneNumbersResponse = await fetch('/api/user/phone-numbers');
          if (phoneNumbersResponse.ok) {
            const phoneNumbersData = await phoneNumbersResponse.json();
            const numbers = phoneNumbersData.phoneNumbers || [];
            setSenderNumbers(numbers.filter((n: any) => n.isActive));

            // Show warning if no numbers available
            if (numbers.length === 0) {
              toast({
                title: 'No Phone Numbers',
                description: 'You have no phone numbers assigned. Contact your admin.',
                variant: 'destructive',
              });
            }
          } else {
            console.warn('Failed to fetch phone numbers, using empty array');
            setSenderNumbers([]);
          }
        } catch (phoneError) {
          console.warn('Error fetching phone numbers:', phoneError);
          setSenderNumbers([]);
        }

      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load phone numbers',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toast]);


  // Reset to full, unfiltered contacts pool on mount so totals (e.g., Select All Pages) match dashboard
  useEffect(() => {
    searchContacts('', {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const addSenderNumber = async () => {
    if (!newSenderNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Phone number is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/telnyx/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: newSenderNumber.trim(),
          state: newSenderState.trim() || null,
          capabilities: ['SMS', 'VOICE'],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add phone number');
      }

      const newPhoneNumber = await response.json();
      setSenderNumbers([...senderNumbers, newPhoneNumber]);
      setNewSenderNumber("");
      setNewSenderState("");
      setShowAddNumberDialog(false);

      toast({
        title: 'Success',
        description: 'Phone number added successfully',
      });
    } catch (error) {
      console.error('Error adding phone number:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add phone number',
        variant: 'destructive',
      });
    }
  }

  const removeSenderNumber = async (id: string) => {
    try {
      const response = await fetch(`/api/telnyx/phone-numbers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove phone number');
      }

      setSenderNumbers(senderNumbers.filter((n) => n.id !== id));

      toast({
        title: 'Success',
        description: 'Phone number removed successfully',
      });
    } catch (error) {
      console.error('Error removing phone number:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove phone number',
        variant: 'destructive',
      });
    }
  }


  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setMessage(template.content)
    }
  }

  const formatMessage = (template: string, contact: Contact) => {
    let formattedMessage = template

    if (contact.firstName) {
      formattedMessage = formattedMessage.replace(/\{firstName\}/g, contact.firstName)
    }

    if (contact.lastName) {
      formattedMessage = formattedMessage.replace(/\{lastName\}/g, contact.lastName)
    }

    if (contact.propertyAddress) {
      formattedMessage = formattedMessage.replace(/\{propertyAddress\}/g, contact.propertyAddress)
    }

    if (contact.propertyType) {
      formattedMessage = formattedMessage.replace(/\{propertyType\}/g, contact.propertyType)
    }

    return formattedMessage
  }

  const handleSendBlast = async () => {
    if (!message.trim() || selectedContacts.length === 0 || !Array.isArray(senderNumbers) || senderNumbers.length === 0) {
      toast({
        title: "Cannot send messages",
        description: "Please select contacts, a message template, and add sender numbers",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setIsPaused(false)
    setSentCount(0)
    setProgress(0)

    // Add to global process tracking
    const processId = addProcess({
      type: "text",
      label: `Text Blast (${selectedContacts.length} contacts)`,
      progress: 0,
      total: selectedContacts.length,
      isPaused: false,
    })

    setCurrentProcessId(processId)

    toast({
      title: "Text Blast Started",
      description: `Sending messages to ${selectedContacts.length} contacts`,
    })

    // Simulate sending messages
    for (let i = 0; i < selectedContacts.length; i++) {
      if (isPaused) {
        // Wait until unpaused
        await new Promise<void>((resolve) => {
          const checkPaused = () => {
            if (!isPaused) {
              resolve()
            } else {
              setTimeout(checkPaused, 500)
            }
          }
          checkPaused()
        })
      }

      const contact = selectedContacts[i]
      const senderNumber = senderNumbers[i % senderNumbers.length]
      const formattedMessage = formatMessage(message, contact)

      // Send SMS via Telnyx API
      try {
        const response = await fetch('/api/telnyx/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromNumber: senderNumber.phoneNumber,
            toNumber: getBestPhoneNumber(contact),
            message: formattedMessage,
            contactId: contact.id,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`Failed to send SMS to ${contact.phone1}:`, error);
        } else {
          console.log(`SMS sent to ${contact.phone1} from ${senderNumber.phoneNumber}`);
        }
      } catch (error) {
        console.error(`Error sending SMS to ${contact.phone1}:`, error);
      }

      // Update progress
      setSentCount(i + 1)
      setProgress(Math.round(((i + 1) / selectedContacts.length) * 100))

      // Update global process state
      if (currentProcessId) {
        updateProcess(currentProcessId, { progress: i + 1 })
      }

      // Add random delay between messages
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin)
      await new Promise((resolve) => setTimeout(resolve, delay * 100)) // Using 100ms instead of 1000ms for demo
    }

    setIsSending(false)

    toast({
      title: "Bulk messaging complete",
      description: `Successfully sent ${selectedContacts.length} messages`,
    })
  }

  const handlePauseBlast = () => {
    setIsPaused(true)
    if (currentProcessId) {
      pauseProcess(currentProcessId)
      toast({
        title: "Text Blast Paused",
        description: "Message sending has been paused",
      })
    }
  }

  const handleResumeBlast = () => {
    setIsPaused(false)
    if (currentProcessId) {
      resumeProcess(currentProcessId)
      toast({
        title: "Text Blast Resumed",
        description: "Message sending has been resumed",
      })
    }
  }

  // Template management functions
  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateContent("")
    setShowTemplateDialog(true)
    setActiveTemplateTab("create")
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateContent(template.content)
    setShowTemplateDialog(true)
    setActiveTemplateTab("create")
  }

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId))
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null)
    }
    toast({
      title: "Template deleted",
      description: "The message template has been deleted",
    })
  }

  const handleDuplicateTemplate = (template: Template) => {
    const newId = `template-${Date.now()}`
    const duplicatedTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (Copy)`,
    }

    setTemplates([...templates, duplicatedTemplate])
    toast({
      title: "Template duplicated",
      description: "A copy of the template has been created",
    })
  }

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !templateContent.trim()) {
      toast({
        title: "Error",
        description: "Template name and content are required",
        variant: "destructive",
      })
      return
    }

    // Extract variables from content (format: {variableName})
    const variableRegex = /\{([^}]+)\}/g
    const matches = Array.from(templateContent.matchAll(variableRegex))
    const variables: string[] = []

    for (const match of matches) {
      if (match[1] && !variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    if (editingTemplate) {
      setTemplates(
        templates.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                name: templateName,
                content: templateContent,
                variables,
              }
            : t,
        ),
      )

      toast({
        title: "Template updated",
        description: "The message template has been updated",
      })
    } else {
      const newId = `template-${Date.now()}`
      setTemplates([
        ...templates,
        {
          id: newId,
          name: templateName,
          content: templateContent,
          variables,
        },
      ])

      toast({
        title: "Template created",
        description: "New message template has been created",
      })
    }

    setShowTemplateDialog(false)
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateContent("")
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Text Blast</h3>
        <p className="text-sm text-gray-500 mb-4">Send a text message to multiple contacts at once.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">Recipients</h4>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md mb-4">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-muted-foreground" />
                  <span>
                    {selectedContacts.length} of {filteredContacts.length} contacts selected ({pagination?.totalCount ?? contacts.length} total)
                  </span>
                </div>
              </div>

              <AdvancedContactFilter
                contacts={contacts}
                onFilteredContactsChange={setFilteredContacts}
                selectedContacts={selectedContacts}
                onSelectedContactsChange={setSelectedContacts}
                showList
              />
            </CardContent>
          </Card>

          {/* Message Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Message</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="message">Message Content</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[150px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You can use {"{firstName}"}, {"{lastName}"}, {"{propertyAddress}"}, and {"{propertyType}"} as
                    placeholders.
                  </p>
                </div>

                {isSending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress:</span>
                      <span>
                        {sentCount} of {selectedContacts.length}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <div className="flex justify-end">
                  {isSending ? (
                    <div className="flex gap-2">
                      {isPaused ? (
                        <Button onClick={handleResumeBlast} className="flex items-center gap-2">
                          <Play size={16} />
                          Resume Sending
                        </Button>
                      ) : (
                        <Button onClick={handlePauseBlast} variant="outline" className="flex items-center gap-2">
                          <Pause size={16} />
                          Pause Sending
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={handleSendBlast}
                      disabled={!message.trim() || selectedContacts.length === 0 || !Array.isArray(senderNumbers) || senderNumbers.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Send size={16} />
                      Send to {selectedContacts.length} Contact{selectedContacts.length !== 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium mb-4">Sender Phone Numbers</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Messages will be sent using these numbers in rotation
              </p>

              <div className="space-y-2 mb-4">
                {Array.isArray(senderNumbers) && senderNumbers.map((number, index) => (
                  <div key={number.id || index} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{number.phoneNumber}</span>
                        {number.state && (
                          <span className="text-sm text-muted-foreground ml-2">({number.state})</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {number.capabilities?.join(', ')} • Used: {number.totalSmsCount || 0} SMS, {number.totalCallCount || 0} calls
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeSenderNumber(number.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {(!Array.isArray(senderNumbers) || senderNumbers.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No Telnyx phone numbers added. Add numbers to start sending messages.
                  </p>
                )}
              </div>

              <Button
                onClick={() => setShowAddNumberDialog(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Telnyx Phone Number
              </Button>
            </CardContent>
          </Card>

          {/* Message Templates */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Message Templates</CardTitle>
                <Button variant="outline" size="sm" onClick={handleCreateTemplate}>
                  <Plus size={16} className="mr-2" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-3">
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No templates available
                  </p>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        handleSelectTemplate(template.id)
                        setMessage(template.content)
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-sm">{template.name}</h5>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-600 hover:text-gray-900"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditTemplate(template)
                            }}
                          >
                            <Edit size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-600 hover:text-gray-900"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicateTemplate(template)
                            }}
                          >
                            <Copy size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-600 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTemplate(template.id)
                            }}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 overflow-hidden" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {template.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium mb-2">Message Delay Settings</h4>
              <p className="text-sm text-muted-foreground mb-4">Set the delay between messages (in seconds)</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delay-min">Minimum Delay</Label>
                  <Input
                    id="delay-min"
                    type="number"
                    min="1"
                    max="60"
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delay-max">Maximum Delay</Label>
                  <Input
                    id="delay-max"
                    type="number"
                    min="1"
                    max="60"
                    value={delayMax}
                    onChange={(e) => setDelayMax(Number(e.target.value))}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                A random delay between {delayMin} and {delayMax} seconds will be applied between messages to avoid rate limits
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTemplateTab} onValueChange={setActiveTemplateTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="select">Select Template</TabsTrigger>
              <TabsTrigger value="create">Create/Edit Template</TabsTrigger>
            </TabsList>

            <TabsContent value="select" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-1 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDuplicateTemplate(template)}
                            >
                              <Copy size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{template.content}</p>
                        {template.variables.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Variables:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {template.variables.map((variable) => (
                                <span key={variable} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {variable}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            handleSelectTemplate(template.id)
                            setShowTemplateDialog(false)
                          }}
                        >
                          Use Template
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <Button variant="outline" onClick={() => setActiveTemplateTab("create")} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create New Template
              </Button>
            </TabsContent>

            <TabsContent value="create" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="Enter template name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-content">Message Content</Label>
                  <Textarea
                    id="template-content"
                    placeholder="Enter your message template. Use {firstName}, {propertyAddress}, etc. for variables."
                    rows={8}
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use curly braces to add variables: {"{firstName}"}, {"{propertyAddress}"}, {"{cityState}"}, etc.
                  </p>
                </div>

                <div className="pt-2">
                  <h5 className="text-sm font-medium mb-3">Available Variables</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      <span className="font-medium">{"{firstName}"}</span>
                    </div>
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      <span className="font-medium">{"{lastName}"}</span>
                    </div>
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      <span className="font-medium">{"{propertyAddress}"}</span>
                    </div>
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      <span className="font-medium">{"{cityState}"}</span>
                    </div>
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      <span className="font-medium">{"{propertyType}"}</span>
                    </div>
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      <span className="font-medium">{"{llcName}"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            {activeTemplateTab === "create" ? (
              <div className="flex justify-end gap-3 w-full">
                <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} className="bg-gray-900 hover:bg-gray-800">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Phone Number Dialog */}
      <Dialog open={showAddNumberDialog} onOpenChange={setShowAddNumberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Telnyx Phone Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                placeholder="+1234567890"
                value={newSenderNumber}
                onChange={(e) => setNewSenderNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State (Optional)</Label>
              <Input
                id="state"
                placeholder="e.g., CA, NY, TX"
                value={newSenderState}
                onChange={(e) => setNewSenderState(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Add your Telnyx phone number to start sending SMS and making calls. Make sure the number is configured in your Telnyx dashboard.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNumberDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSenderNumber} disabled={!newSenderNumber.trim()}>
              Add Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

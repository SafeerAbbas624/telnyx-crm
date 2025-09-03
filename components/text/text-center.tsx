"use client"

import { useState, useEffect } from "react"
import { useContacts } from "@/lib/context/contacts-context"
import EnhancedConversationsList from "@/components/text/enhanced-conversations-list"
import EnhancedConversation from "@/components/text/enhanced-conversation"
import EnhancedTextBlast from "@/components/text/enhanced-text-blast"
import TextAutomation from "@/components/text/text-automation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMediaQuery } from "@/hooks/use-media-query"
import { MessageSquare, Send, Repeat } from "lucide-react"
import type { Contact } from "@/lib/types"

interface TextCenterProps {
  selectedContactId?: string | null
}

export default function TextCenter({ selectedContactId }: TextCenterProps) {
  const { contacts } = useContacts()
  const [activeTab, setActiveTab] = useState("conversations")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Handle selectedContactId from URL parameter
  useEffect(() => {
    if (selectedContactId && contacts.length > 0) {
      const contact = contacts.find(c => c.id === selectedContactId)
      if (contact) {
        setSelectedContact(contact)
        setActiveTab("conversations")
        if (isMobile) {
          setShowConversation(true)
        }
      }
    }
  }, [selectedContactId, contacts, isMobile])

  // Reset selected contact when changing tabs
  useEffect(() => {
    if (!selectedContactId) {
      setSelectedContact(null)
      setShowConversation(false)
    }
  }, [activeTab, selectedContactId])

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)
    if (isMobile) {
      setShowConversation(true)
    }
  }

  const handleBackToList = () => {
    setShowConversation(false)
  }

  if (isMobile && showConversation && selectedContact) {
    return <EnhancedConversation contact={selectedContact} onBack={handleBackToList} />
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Text Center</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Conversations</span>
            </TabsTrigger>
            <TabsTrigger value="blast" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span>Text Blast</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              <span>Text Automation</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="conversations" className="m-0">
              <div className="flex h-[calc(100vh-180px)]">
                <div className={`${isMobile ? "w-full" : "w-1/3 border-r"}`}>
                  <EnhancedConversationsList
                    selectedContactId={selectedContact?.id}
                    onSelectContact={handleSelectContact}
                  />
                </div>
                {!isMobile && (
                  <div className="w-2/3">
                    {selectedContact ? (
                      <EnhancedConversation contact={selectedContact} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <p>Select a conversation to start messaging</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="blast" className="m-0">
              <EnhancedTextBlast />
            </TabsContent>
            <TabsContent value="automation" className="m-0">
              <TextAutomation />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

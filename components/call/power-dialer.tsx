"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { contacts } from "@/lib/mock-data"
import type { Contact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Filter, Play, Pause, SkipForward, Phone, PhoneOff, VoicemailIcon, Clock, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ActiveContact {
  contact: Contact;
  status: string;
  duration: number;
  startTime: number;
}

export default function PowerDialer() {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [isDialing, setIsDialing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentContactIndex, setCurrentContactIndex] = useState(0)
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "connected" | "ended">("idle")
  const [callDuration, setCallDuration] = useState(0)
  const [callNotes, setCallNotes] = useState("")
  const [callOutcome, setCallOutcome] = useState<"completed" | "no_answer" | "voicemail" | null>(null)
  const [concurrentLines, setConcurrentLines] = useState(3)
  const [concurrentLinesInput, setConcurrentLinesInput] = useState("3")
  const [activeContacts, setActiveContacts] = useState<ActiveContact[]>([])
  const [callTimerId, setCallTimerId] = useState<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // Property types
  const propertyTypes = [
    { id: "single-family", label: "Single-Family" },
    { id: "duplex", label: "Duplex" },
    { id: "triplex", label: "Triplex" },
    { id: "quadplex", label: "Quadplex" },
    { id: "multi-family", label: "Multi-Family" },
  ]

  // South Florida cities
  const cities = [
    { id: "miami", label: "Miami" },
    { id: "fort-lauderdale", label: "Fort Lauderdale" },
    { id: "west-palm-beach", label: "West Palm Beach" },
    { id: "boca-raton", label: "Boca Raton" },
    { id: "coral-gables", label: "Coral Gables" },
    { id: "hollywood", label: "Hollywood" },
    { id: "pompano-beach", label: "Pompano Beach" },
  ]

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (callTimerId) {
        clearInterval(callTimerId)
      }
    }
  }, [callTimerId])

  // Update call duration
  useEffect(() => {
    if (callStatus === "connected" && !isPaused) {
      const timerId = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
      setCallTimerId(timerId)
      return () => clearInterval(timerId)
    } else if (callTimerId) {
      clearInterval(callTimerId)
      setCallTimerId(null)
    }
  }, [callStatus, isPaused, callTimerId])

  // Filter contacts based on selected filters
  const filteredContacts = contacts.filter((contact) => {
    // Filter by property type
    const propertyTypeMatch =
      selectedPropertyTypes.length === 0 ||
      (contact.propertyType && selectedPropertyTypes.includes(contact.propertyType))

    // Filter by city
    const cityMatch =
      selectedCities.length === 0 ||
      (contact.propertyAddress &&
        selectedCities.some((city) => contact.propertyAddress!.toLowerCase().includes(city.toLowerCase())))

    // Filter by new contacts (no previous interactions)
    const isNewContact = contact.tags?.some((tag) => tag.name === "New Contact") || false
    const newContactMatch = !selectedTags.includes("new") || isNewContact

    return propertyTypeMatch && cityMatch && newContactMatch
  })

  const handlePropertyTypeChange = (type: string) => {
    if (selectedPropertyTypes.includes(type)) {
      setSelectedPropertyTypes(selectedPropertyTypes.filter((t) => t !== type))
    } else {
      setSelectedPropertyTypes([...selectedPropertyTypes, type])
    }
  }

  const handleCityChange = (city: string) => {
    if (selectedCities.includes(city)) {
      setSelectedCities(selectedCities.filter((c) => c !== city))
    } else {
      setSelectedCities([...selectedCities, city])
    }
  }

  const handleNewContactsChange = () => {
    if (selectedTags.includes("new")) {
      setSelectedTags(selectedTags.filter((t) => t !== "new"))
    } else {
      setSelectedTags([...selectedTags, "new"])
    }
  }

  const handleStartDialer = () => {
    if (filteredContacts.length === 0) return

    setIsDialing(true)
    setIsPaused(false)
    setCurrentContactIndex(0)

    // Initialize active contacts based on concurrent lines
    const initialActiveContacts = []
    for (let i = 0; i < Math.min(concurrentLines, filteredContacts.length); i++) {
      initialActiveContacts.push({
        contact: filteredContacts[i],
        status: "calling",
        duration: 0,
        startTime: Date.now(),
      })
    }
    setActiveContacts(initialActiveContacts)

    startCall()

    toast({
      title: "Power dialer started",
      description: `Dialing with ${concurrentLines} concurrent lines`,
    })
  }

  const handlePauseDialer = () => {
    setIsPaused(!isPaused)

    toast({
      title: isPaused ? "Dialer resumed" : "Dialer paused",
    })
  }

  const handleSkipContact = () => {
    // Clear any existing timer
    if (callTimerId) {
      clearInterval(callTimerId)
      setCallTimerId(null)
    }

    // Move to next contact
    const nextIndex = currentContactIndex + 1
    if (nextIndex < filteredContacts.length) {
      setCurrentContactIndex(nextIndex)
      setCallStatus("idle")
      setCallDuration(0)
      setCallNotes("")
      setCallOutcome(null)

      // If not paused, start call to next contact
      if (!isPaused) {
        startCall()
      }

      toast({
        title: "Skipped to next contact",
      })
    } else {
      // End of contact list
      setIsDialing(false)
      setCallStatus("idle")

      toast({
        title: "End of contact list",
        description: "All contacts have been processed",
      })
    }
  }

  const startCall = () => {
    setCallStatus("calling")

    // Simulate call connection after 2 seconds
    setTimeout(() => {
      if (!isPaused) {
        setCallStatus("connected")
      }
    }, 2000)
  }

  const handleEndCall = (outcome: "completed" | "no_answer" | "voicemail") => {
    // Clear the interval
    if (callTimerId) {
      clearInterval(callTimerId)
      setCallTimerId(null)
    }

    setCallStatus("ended")
    setCallOutcome(outcome)

    toast({
      title: "Call ended",
      description: `Call outcome: ${outcome.replace("_", " ")}`,
    })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const handleSaveCall = () => {
    if (!filteredContacts[currentContactIndex] || !callOutcome) return

    // In a real app, this would save the call record
    console.log("Saving call:", {
      contactId: filteredContacts[currentContactIndex].id,
      duration: callDuration,
      status: callOutcome,
      notes: callNotes,
    })

    // Move to next contact
    handleSkipContact()

    toast({
      title: "Call notes saved",
      description: "Moving to next contact",
    })
  }

  const handleConcurrentLinesChange = (value: number[]) => {
    setConcurrentLines(value[0])
    setConcurrentLinesInput(value[0].toString())
  }

  const handleConcurrentLinesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setConcurrentLinesInput(value)

    const numValue = Number.parseInt(value)
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
      setConcurrentLines(numValue)
    }
  }

  const handleConcurrentLinesInputBlur = () => {
    const numValue = Number.parseInt(concurrentLinesInput)
    if (isNaN(numValue) || numValue < 1) {
      setConcurrentLines(1)
      setConcurrentLinesInput("1")
    } else if (numValue > 10) {
      setConcurrentLines(10)
      setConcurrentLinesInput("10")
    } else {
      setConcurrentLines(numValue)
      setConcurrentLinesInput(numValue.toString())
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 h-full">
      {/* Left side - Contact queue */}
      <div className="border-r border-gray-200 h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Contact Queue</h3>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} className="mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-4 p-4 border rounded-md mb-4">
              <div>
                <h5 className="text-sm font-medium mb-2">Property Type</h5>
                <div className="grid grid-cols-2 gap-2">
                  {propertyTypes.map((type) => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.id}`}
                        checked={selectedPropertyTypes.includes(type.id)}
                        onCheckedChange={() => handlePropertyTypeChange(type.id)}
                      />
                      <Label htmlFor={`type-${type.id}`} className="text-sm">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="text-sm font-medium mb-2">Location</h5>
                <Tabs defaultValue="all">
                  <TabsList className="mb-2">
                    <TabsTrigger value="all">All Cities</TabsTrigger>
                    <TabsTrigger value="miami">Miami</TabsTrigger>
                    <TabsTrigger value="ftl">Fort Lauderdale</TabsTrigger>
                    <TabsTrigger value="wpb">West Palm Beach</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all">
                    <div className="grid grid-cols-2 gap-2">
                      {cities.map((city) => (
                        <div key={city.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`city-${city.id}`}
                            checked={selectedCities.includes(city.id)}
                            onCheckedChange={() => handleCityChange(city.id)}
                          />
                          <Label htmlFor={`city-${city.id}`}>{city.label}</Label>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="miami">
                    <div className="p-3 bg-muted/30 rounded-md">
                      <Button variant="outline" size="sm" onClick={() => setSelectedCities(["miami"])}>
                        Filter to Miami only
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="ftl">
                    <div className="p-3 bg-muted/30 rounded-md">
                      <Button variant="outline" size="sm" onClick={() => setSelectedCities(["fort-lauderdale"])}>
                        Filter to Fort Lauderdale only
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="wpb">
                    <div className="p-3 bg-muted/30 rounded-md">
                      <Button variant="outline" size="sm" onClick={() => setSelectedCities(["west-palm-beach"])}>
                        Filter to West Palm Beach only
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="new-contacts"
                    checked={selectedTags.includes("new")}
                    onCheckedChange={handleNewContactsChange}
                  />
                  <Label htmlFor="new-contacts">Only New Contacts (No Previous Outreach)</Label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(false)}>
                  <X size={16} className="mr-2" />
                  Close Filters
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="concurrent-lines">Concurrent Calls</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider
                  id="concurrent-lines"
                  value={[concurrentLines]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={handleConcurrentLinesChange}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={concurrentLinesInput}
                  onChange={handleConcurrentLinesInputChange}
                  onBlur={handleConcurrentLinesInputBlur}
                  min={1}
                  max={10}
                  className="w-16 text-center"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Number of simultaneous calls (1-10)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md my-4">
            <Phone size={18} className="text-muted-foreground" />
            <span>
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""} in queue
            </span>
          </div>

          <div className="flex gap-2">
            {!isDialing ? (
              <Button
                onClick={handleStartDialer}
                disabled={filteredContacts.length === 0}
                className="flex-1 flex items-center gap-2"
              >
                <Play size={16} />
                Start Power Dialer
              </Button>
            ) : (
              <>
                {isPaused ? (
                  <Button onClick={handlePauseDialer} className="flex-1 flex items-center gap-2">
                    <Play size={16} />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={handlePauseDialer} variant="outline" className="flex-1 flex items-center gap-2">
                    <Pause size={16} />
                    Pause
                  </Button>
                )}
                <Button onClick={handleSkipContact} variant="outline" className="flex items-center gap-2">
                  <SkipForward size={16} />
                  Skip
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isDialing && activeContacts.length > 0 ? (
            <div className="p-4">
              <h4 className="font-medium mb-3">Active Calls ({activeContacts.length})</h4>
              <div className="space-y-3">
                {activeContacts.map((item, index) => (
                  <Card key={index} className={index === 0 ? "border-primary" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {item.contact.firstName[0]}
                              {item.contact.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {item.contact.firstName} {item.contact.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">{item.contact.phone}</div>
                          </div>
                        </div>
                        <Badge
                          className={
                            item.status === "calling"
                              ? "bg-blue-100 text-blue-800"
                              : item.status === "connected"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                          }
                        >
                          {item.status === "calling"
                            ? "Calling..."
                            : item.status === "connected"
                              ? "Connected"
                              : "Ended"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">{item.contact.propertyAddress}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No contacts in queue</p>
            </div>
          ) : (
            <div>
              {filteredContacts.map((contact, index) => (
                <div
                  key={contact.id}
                  className={`p-4 border-b border-gray-200 ${
                    index === currentContactIndex && isDialing ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 text-center">
                      {index === currentContactIndex && isDialing ? (
                        <span className="inline-block w-3 h-3 bg-primary rounded-full animate-pulse"></span>
                      ) : (
                        <span className="text-gray-500">{index + 1}</span>
                      )}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {contact.firstName[0]}
                        {contact.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </h3>
                      <div className="text-sm text-gray-600">{contact.phone}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Call interface */}
      <div className="p-4 flex flex-col h-full">
        {isDialing && filteredContacts[currentContactIndex] ? (
          <>
            <Card className="mb-4">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {filteredContacts[currentContactIndex].firstName[0]}
                      {filteredContacts[currentContactIndex].lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {filteredContacts[currentContactIndex].firstName} {filteredContacts[currentContactIndex].lastName}
                    </h3>
                    <p className="text-gray-600">{filteredContacts[currentContactIndex].phone}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {filteredContacts[currentContactIndex].propertyAddress}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-md mb-4">
                  <h4 className="font-medium mb-2">Call Script</h4>
                  <p className="text-sm">
                    Hi {filteredContacts[currentContactIndex].firstName}, this is Dan with Adler Capital. I&apos;m just
                    calling to see if you&apos;d be thinking about refinancing your property at{" "}
                    {filteredContacts[currentContactIndex].propertyAddress}?
                  </p>
                </div>

                <div className="flex justify-center gap-4 my-6">
                  {callStatus === "idle" && !isPaused && (
                    <div className="text-center">
                      <div className="text-lg font-medium mb-2">Ready to call</div>
                      <Button
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                        onClick={startCall}
                      >
                        <Phone size={18} />
                        Start Call
                      </Button>
                    </div>
                  )}

                  {callStatus === "idle" && isPaused && (
                    <div className="text-center">
                      <div className="text-lg font-medium mb-2">Dialer Paused</div>
                    </div>
                  )}

                  {callStatus === "calling" && (
                    <div className="text-center">
                      <div className="text-lg font-medium mb-2">Calling...</div>
                      <div className="flex justify-center gap-4">
                        <Button
                          variant="destructive"
                          onClick={() => handleEndCall("no_answer")}
                          className="flex items-center gap-2"
                        >
                          <PhoneOff size={18} />
                          End Call
                        </Button>
                      </div>
                    </div>
                  )}

                  {callStatus === "connected" && (
                    <div className="text-center">
                      <div className="text-lg font-medium mb-2 flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        Connected
                      </div>
                      <div className="text-gray-500 mb-4" id="call-timer">
                        <Clock size={16} className="inline mr-1" />
                        {formatDuration(callDuration)}
                      </div>
                      <div className="flex justify-center gap-4">
                        <Button
                          variant="destructive"
                          onClick={() => handleEndCall("completed")}
                          className="flex items-center gap-2"
                        >
                          <PhoneOff size={18} />
                          End Call
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleEndCall("voicemail")}
                          className="flex items-center gap-2"
                        >
                          <VoicemailIcon size={18} />
                          Leave Voicemail
                        </Button>
                      </div>
                    </div>
                  )}

                  {callStatus === "ended" && (
                    <div className="text-center">
                      <Badge
                        className={`
                          ${callOutcome === "completed" ? "bg-green-100 text-green-800 border-green-200" : ""}
                          ${callOutcome === "no_answer" ? "bg-red-100 text-red-800 border-red-200" : ""}
                          ${callOutcome === "voicemail" ? "bg-amber-100 text-amber-800 border-amber-200" : ""}
                          mb-4
                        `}
                      >
                        {callOutcome === "completed" && "Call Completed"}
                        {callOutcome === "no_answer" && "No Answer"}
                        {callOutcome === "voicemail" && "Left Voicemail"}
                      </Badge>
                      <div className="text-gray-500 mb-4">
                        <Clock size={16} className="inline mr-1" />
                        {formatDuration(callDuration)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {callStatus === "ended" && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Call Notes</h4>
                  <Textarea
                    placeholder="Enter notes about this call..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveCall}>Save & Next Call</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>Start the power dialer to begin calling</p>
          </div>
        )}
      </div>
    </div>
  )
}

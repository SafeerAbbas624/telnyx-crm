'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Loader2,
  Play,
  Users,
  ListOrdered,
  Search,
  X,
  PhoneMissed,
  ExternalLink,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { formatPhoneNumberForDisplay, formatPhoneNumberForTelnyx, getBestPhoneNumber } from '@/lib/phone-utils';
import { useCallUI } from '@/lib/context/call-ui-context';
import CallRecordingPlayer from '@/components/calls/call-recording-player';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

interface TelnyxPhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  state?: string;
  city?: string;
  isActive: boolean;
  capabilities: string[];
}

interface TelnyxCall {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  duration: number;
  fromNumber: string;
  toNumber: string;
  createdAt: string;
  answeredAt?: string;
  endedAt?: string;
  recordingUrl?: string;
  contactId?: string;
  contactName?: string;
  transcript?: string;
  transcriptSearchable?: string;
}

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  email1?: string;
  propertyAddress?: string;
}

export default function CallsCenterModern() {
  const { openCall } = useCallUI();
  const [phoneNumbers, setPhoneNumbers] = useState<TelnyxPhoneNumber[]>([]);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TelnyxPhoneNumber | null>(null);
  const [dialNumber, setDialNumber] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickSearchResults, setQuickSearchResults] = useState<Contact[]>([]);
  const [recentCalls, setRecentCalls] = useState<TelnyxCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeRecording, setActiveRecording] = useState<TelnyxCall | null>(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const quickSearchRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Auto-focus the quick search on page load
  useEffect(() => {
    if (quickSearchRef.current) {
      quickSearchRef.current.focus();
    }
    loadData();
  }, []);

  // Search contacts as user types
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (quickSearch.length >= 2) {
        setIsSearching(true);
        try {
          const response = await fetch(`/api/contacts?search=${encodeURIComponent(quickSearch)}&limit=8`);
          if (response.ok) {
            const data = await response.json();
            setQuickSearchResults(data.contacts || []);
            setShowSearchResults(true);
          }
        } catch (error) {
          console.error('Error searching contacts:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setQuickSearchResults([]);
        setShowSearchResults(false);
      }
    }, 200);
    return () => clearTimeout(searchTimer);
  }, [quickSearch]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(e.target as Node) &&
          quickSearchRef.current && !quickSearchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [phoneNumbersRes, callsRes] = await Promise.all([
        fetch('/api/telnyx/phone-numbers'),
        fetch('/api/telnyx/calls'),
      ]);

      if (phoneNumbersRes.ok) {
        const phoneNumbersData = await phoneNumbersRes.json();
        const voiceNumbers = phoneNumbersData.filter(
          (pn: TelnyxPhoneNumber) => pn.capabilities.includes('VOICE') && pn.isActive
        );
        setPhoneNumbers(voiceNumbers);
        if (voiceNumbers.length > 0 && !selectedPhoneNumber) {
          setSelectedPhoneNumber(voiceNumbers[0]);
        }
      }

      if (callsRes.ok) {
        const callsData = await callsRes.json();
        const calls = Array.isArray(callsData) ? callsData : callsData.calls || [];
        console.log('[CALLS] Loaded calls:', calls.length, 'With recordings:', calls.filter((c: TelnyxCall) => c.recordingUrl).length);
        console.log('[CALLS] First call:', calls[0]);
        setRecentCalls(calls);
      } else {
        console.error('[CALLS] Failed to fetch calls:', callsRes.status, callsRes.statusText);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Make call using WebRTC
  const makeCall = async (toNumber: string, contact?: Contact) => {
    if (!selectedPhoneNumber) {
      toast.error('Please select a phone number to call from');
      return;
    }

    const normalizedTo = formatPhoneNumberForTelnyx(toNumber);
    if (!normalizedTo) {
      toast.error('Invalid phone number');
      return;
    }

    try {
      setIsCalling(true);
      const fromNumber = selectedPhoneNumber.phoneNumber;

      // Start WebRTC call
      const { rtcClient } = await import('@/lib/webrtc/rtc-client');
      await rtcClient.ensureRegistered();
      const { sessionId } = await rtcClient.startCall({ toNumber: normalizedTo, fromNumber });

      // Log the call to database
      fetch('/api/telnyx/webrtc-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webrtcSessionId: sessionId,
          contactId: contact?.id,
          fromNumber,
          toNumber: normalizedTo,
        }),
      }).catch(err => console.error('Failed to log call:', err));

      // Open the call popup
      openCall({
        contact: contact ? {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName
        } : undefined,
        fromNumber,
        toNumber: normalizedTo,
        mode: 'webrtc',
        webrtcSessionId: sessionId,
      });

      // Clear inputs
      setDialNumber('');
      setQuickSearch('');
      setQuickSearchResults([]);
      setShowSearchResults(false);

      toast.success('Call initiated');

      // Reload calls after a delay
      setTimeout(() => loadData(), 2000);
    } catch (error: any) {
      console.error('Error making call:', error);
      toast.error(error.message || 'Failed to initiate call');
    } finally {
      setIsCalling(false);
    }
  };

  // Quick call from search result
  const callContact = (contact: Contact) => {
    const phone = getBestPhoneNumber(contact);
    if (!phone) {
      toast.error('Contact has no valid phone number');
      return;
    }
    makeCall(phone, contact);
  };

  // Handle Enter key in quick search - if looks like phone number, call it directly
  const handleQuickSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const digits = quickSearch.replace(/\D/g, '');
      if (digits.length >= 10) {
        // Looks like a phone number, call directly
        makeCall(quickSearch);
      } else if (quickSearchResults.length === 1) {
        // Single search result, call that contact
        callContact(quickSearchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSearchResults(false);
      setQuickSearch('');
    }
  };

  const handleDialPadClick = (digit: string) => {
    setDialNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
  };

  const getCallIcon = (direction: string, status: string) => {
    if (status === 'failed' || status === 'missed') {
      return <PhoneMissed className="h-4 w-4 text-red-500" />;
    }
    if (direction === 'inbound') {
      return <PhoneIncoming className="h-4 w-4 text-green-600" />;
    }
    return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
  };

  const formatCallTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return format(date, "'Today' h:mm a");
    if (isYesterday(date)) return format(date, "'Yesterday' h:mm a");
    return format(date, 'MMM d, h:mm a');
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Quick Search */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-xl relative">
            {/* Quick Search Bar - Main Focus */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                ref={quickSearchRef}
                type="text"
                placeholder="Type name or paste number to call instantly..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                onKeyDown={handleQuickSearchKeyDown}
                onFocus={() => quickSearchResults.length > 0 && setShowSearchResults(true)}
                className="pl-10 pr-10 h-12 text-lg"
              />
              {quickSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => {
                    setQuickSearch('');
                    setShowSearchResults(false);
                    quickSearchRef.current?.focus();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && quickSearchResults.length > 0 && (
              <div
                ref={searchResultsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
              >
                {quickSearchResults.map((contact) => {
                  const phone = getBestPhoneNumber(contact);
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => callContact(contact)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {phone ? formatPhoneNumberForDisplay(phone) : 'No phone'}
                          {contact.propertyAddress && ` • ${contact.propertyAddress}`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="ml-3 bg-green-600 hover:bg-green-700"
                        disabled={!phone || isCalling}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (phone) callContact(contact);
                        }}
                      >
                        {isCalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phone Number Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 whitespace-nowrap">Call from:</span>
            <Select
              value={selectedPhoneNumber?.id || ''}
              onValueChange={(value) => {
                const number = phoneNumbers.find((pn) => pn.id === value);
                setSelectedPhoneNumber(number || null);
              }}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select number" />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers.map((pn) => (
                  <SelectItem key={pn.id} value={pn.id}>
                    <div className="flex flex-col">
                      <span>{formatPhoneNumberForDisplay(pn.phoneNumber)}</span>
                      {pn.friendlyName && (
                        <span className="text-xs text-muted-foreground">{pn.friendlyName}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content - Manual Dialer */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Left Side: Dialer */}
              <div className="lg:col-span-1">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Dial Pad
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Phone Number Input - Large and Prominent */}
                      <div>
                        <Input
                          type="tel"
                          placeholder="Paste or type phone number..."
                          value={dialNumber}
                          onChange={(e) => setDialNumber(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && dialNumber.trim()) {
                              makeCall(dialNumber);
                            }
                          }}
                          className="text-xl text-center h-14 font-mono"
                        />
                      </div>

                      {/* Dial Pad */}
                      <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                          <Button
                            key={digit}
                            variant="outline"
                            size="lg"
                            onClick={() => handleDialPadClick(digit)}
                            className="h-12 text-lg font-semibold"
                          >
                            {digit}
                          </Button>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={handleBackspace} className="h-10">
                          ← Clear
                        </Button>
                        <Button
                          onClick={() => makeCall(dialNumber)}
                          disabled={!dialNumber.trim() || isCalling}
                          className="h-10 bg-green-600 hover:bg-green-700"
                        >
                          {isCalling ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Calling...
                            </>
                          ) : (
                            <>
                              <PhoneCall className="h-4 w-4 mr-2" />
                              Call
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Side: Call History */}
              <div className="lg:col-span-2">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Call History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-gray-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading calls...
                      </div>
                    ) : recentCalls.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Phone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No call history yet</p>
                        <p className="text-sm mt-1">Your calls will appear here</p>
                      </div>
                    ) : (
                      <>
                        {/* Recording Player - Show ABOVE the list when active */}
                        {(() => {
                          console.log('[CALLS] Render check - activeRecording:', activeRecording?.id, 'has URL:', !!activeRecording?.recordingUrl);
                          return activeRecording && activeRecording.recordingUrl ? (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <CallRecordingPlayer
                                recordingUrl={activeRecording.recordingUrl}
                                callId={activeRecording.id}
                                contactName={activeRecording.contactName || formatPhoneNumberForDisplay(activeRecording.toNumber)}
                                callDate={formatCallTime(activeRecording.createdAt)}
                                duration={activeRecording.duration}
                                onClose={() => setActiveRecording(null)}
                              />
                            </div>
                          ) : null;
                        })()}
                        <ScrollArea className={activeRecording ? "h-[calc(100vh-500px)]" : "h-[calc(100vh-340px)]"}>
                          <div className="space-y-2">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase border-b">
                              <div className="col-span-1">Type</div>
                              <div className="col-span-3">Contact</div>
                              <div className="col-span-2">From</div>
                              <div className="col-span-2">To</div>
                              <div className="col-span-2">Date/Time</div>
                              <div className="col-span-1">Duration</div>
                              <div className="col-span-1">Recording</div>
                            </div>

                          {/* Call Rows */}
                          {recentCalls.map((call) => (
                            <div key={call.id} className="border-b">
                              <div
                                className="grid grid-cols-12 gap-2 px-3 py-3 items-center hover:bg-gray-50 transition text-sm"
                              >
                                {/* Type Icon */}
                                <div className="col-span-1">
                                  {getCallIcon(call.direction, call.status)}
                                </div>

                                {/* Contact Name */}
                                <div className="col-span-3 truncate">
                                  <span className="font-medium">
                                    {call.contactName || 'Unknown'}
                                  </span>
                                  {call.transcript && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-4 w-4 p-0 ml-2 text-blue-600"
                                      onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                                      title="View Transcript"
                                    >
                                      {expandedCallId === call.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </Button>
                                  )}
                                </div>

                                {/* From Number */}
                                <div className="col-span-2 text-gray-600 truncate text-xs">
                                  {formatPhoneNumberForDisplay(call.fromNumber)}
                                </div>

                                {/* To Number */}
                                <div className="col-span-2 text-gray-600 truncate text-xs">
                                  {formatPhoneNumberForDisplay(call.toNumber)}
                                </div>

                                {/* Date/Time */}
                                <div className="col-span-2 text-gray-600 text-xs">
                                  {formatCallTime(call.createdAt)}
                                </div>

                                {/* Duration */}
                                <div className="col-span-1 text-gray-600 text-xs">
                                  {formatDuration(call.duration)}
                                </div>

                                {/* Actions: Recording + Call Again + Open Contact */}
                                <div className="col-span-1 flex items-center gap-1">
                                {call.recordingUrl ? (
                                  <Button
                                    size="sm"
                                    variant={activeRecording?.id === call.id ? "default" : "ghost"}
                                    className={`h-6 w-6 p-0 ${activeRecording?.id === call.id ? "bg-primary" : "text-blue-600 hover:bg-blue-50"}`}
                                    onClick={() => {
                                      console.log('[CALLS] Play clicked for call:', call.id, 'Has recording:', !!call.recordingUrl);
                                      setActiveRecording(activeRecording?.id === call.id ? null : call);
                                    }}
                                    title="Play Recording"
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                ) : call.duration > 0 ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-gray-400"
                                    onClick={() => toast.info('Recording not available yet - may take a few minutes to process')}
                                    title="No Recording"
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-50"
                                  onClick={() => {
                                    const numberToCall = call.direction === 'outbound' ? call.toNumber : call.fromNumber;
                                    makeCall(numberToCall);
                                  }}
                                  title="Call Again"
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-gray-600 hover:bg-gray-100"
                                  onClick={() => {
                                    // Open call detail or contact page
                                    if (call.contactId) {
                                      window.open(`/contacts/${call.contactId}`, '_blank');
                                    } else {
                                      // Open call detail modal or show call info
                                      const phoneNumber = call.direction === 'outbound' ? call.toNumber : call.fromNumber;
                                      const contactName = call.contactName || 'Unknown';
                                      const callDate = new Date(call.createdAt).toLocaleString();
                                      const duration = call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : 'N/A';
                                      alert(`Call Details:\n\nContact: ${contactName}\nPhone: ${phoneNumber}\nDate: ${callDate}\nDuration: ${duration}\nDirection: ${call.direction}\nStatus: ${call.status}`);
                                    }
                                  }}
                                  title={call.contactId ? "Open Contact" : "View Call Details"}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Transcript Section - Expandable */}
                            {expandedCallId === call.id && call.transcript && (
                              <div className="px-3 py-3 bg-blue-50 border-t">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-900">Call Transcript</span>
                                </div>
                                <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto bg-white p-3 rounded border">
                                  {call.transcript}
                                </div>
                              </div>
                            )}
                          </div>
                          ))}
                        </div>
                      </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
    </div>
  );
}


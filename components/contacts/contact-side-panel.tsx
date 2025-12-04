"use client"

import { useState, useEffect } from "react"
import { X, Phone, Mail, MapPin, Building2, Calendar, Tag, MessageSquare, PhoneCall, FileText, CheckSquare, User, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Contact, Activity } from "@/lib/types"
import { format } from "date-fns"
import { useSmsUI } from "@/lib/context/sms-ui-context"
import { useEmailUI } from "@/lib/context/email-ui-context"
import EditContactDialog from "./edit-contact-dialog"
import { formatPhoneNumberForDisplay } from "@/lib/phone-utils"

interface ContactSidePanelProps {
  contact: Contact | null
  open: boolean
  onClose: () => void
}

interface Task {
  id: string
  subject: string
  description?: string
  status: string
  priority?: string
  dueDate?: string
  taskType?: string
}

export default function ContactSidePanel({ contact, open, onClose }: ContactSidePanelProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [currentContact, setCurrentContact] = useState<Contact | null>(contact)

  const { openSms } = useSmsUI()
  const { openEmail } = useEmailUI()

  useEffect(() => {
    setCurrentContact(contact)
  }, [contact])

  // Fetch full contact details including properties when panel opens
  useEffect(() => {
    const fetchFullContact = async () => {
      if (contact?.id && open) {
        try {
          const res = await fetch(`/api/contacts/${contact.id}`)
          if (res.ok) {
            const fullContact = await res.json()
            setCurrentContact(fullContact)
          }
        } catch (error) {
          console.error('Failed to fetch full contact:', error)
        }
      }
    }
    fetchFullContact()
  }, [contact?.id, open])

  useEffect(() => {
    if (contact?.id && open) {
      loadActivities()
      loadTasks()
    }
  }, [contact?.id, open])

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`
  }

  const handleText = (phone: string) => {
    if (!currentContact) return
    openSms({
      phoneNumber: phone,
      contact: {
        id: currentContact.id,
        firstName: currentContact.firstName,
        lastName: currentContact.lastName,
      },
    })
  }

  const handleEmail = (emailAddr: string) => {
    if (!currentContact) return
    openEmail({
      email: emailAddr,
      contact: {
        id: currentContact.id,
        firstName: currentContact.firstName,
        lastName: currentContact.lastName,
      },
    })
  }

  // Refresh contact data when edit dialog closes
  const handleEditDialogChange = async (open: boolean) => {
    setShowEditDialog(open)
    if (!open && currentContact) {
      // Refresh contact data after edit
      try {
        const res = await fetch(`/api/contacts/${currentContact.id}`)
        if (res.ok) {
          const updated = await res.json()
          setCurrentContact(updated)
        }
      } catch (error) {
        console.error('Failed to refresh contact:', error)
      }
    }
  }

  const loadActivities = async () => {
    if (!contact?.id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/activities?contactId=${contact.id}`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!contact?.id) return

    setLoadingTasks(true)
    try {
      const response = await fetch(`/api/tasks?contactId=${contact.id}`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }

  if (!open || !contact) return null

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4 text-blue-500" />
      case 'email': return <Mail className="h-4 w-4 text-green-500" />
      case 'meeting': return <Calendar className="h-4 w-4 text-purple-500" />
      case 'task': return <CheckSquare className="h-4 w-4 text-orange-500" />
      case 'note': return <FileText className="h-4 w-4 text-gray-500" />
      default: return <MessageSquare className="h-4 w-4 text-gray-400" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-50 border-blue-200'
      case 'email': return 'bg-green-50 border-green-200'
      case 'meeting': return 'bg-purple-50 border-purple-200'
      case 'task': return 'bg-orange-50 border-orange-200'
      case 'note': return 'bg-gray-50 border-gray-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-[600px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {`${currentContact?.firstName || ''} ${currentContact?.lastName || ''}`.trim()}
              </h2>
              {currentContact?.llcName && (
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {currentContact.llcName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="flex items-center gap-1">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Contact Information Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {currentContact?.phone1 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-500" />
                      <span className="text-gray-700">{formatPhoneNumberForDisplay(currentContact.phone1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-blue-50"
                        onClick={() => handleCall(currentContact.phone1!)}
                        title="Call"
                      >
                        <Phone className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-green-50"
                        onClick={() => handleText(currentContact.phone1!)}
                        title="Text"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    </div>
                  </div>
                )}
                {currentContact?.phone2 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600 text-xs">{formatPhoneNumberForDisplay(currentContact.phone2)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-blue-50"
                        onClick={() => handleCall(currentContact.phone2!)}
                        title="Call"
                      >
                        <Phone className="h-3 w-3 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-green-50"
                        onClick={() => handleText(currentContact.phone2!)}
                        title="Text"
                      >
                        <MessageSquare className="h-3 w-3 text-green-600" />
                      </Button>
                    </div>
                  </div>
                )}
                {currentContact?.email1 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-purple-500" />
                      <span className="text-gray-700 truncate max-w-[200px]">{currentContact.email1}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-purple-50"
                      onClick={() => handleEmail(currentContact.email1!)}
                      title="Send Email"
                    >
                      <Mail className="h-3.5 w-3.5 text-purple-600" />
                    </Button>
                  </div>
                )}
                {currentContact?.propertyAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-700">{currentContact.propertyAddress}</p>
                      {(currentContact.city || currentContact.state || currentContact.zipCode) && (
                        <p className="text-gray-600 text-xs">
                          {[currentContact.city, currentContact.state, currentContact.zipCode].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Details Card */}
            {(currentContact?.propertyType || currentContact?.bedrooms || currentContact?.totalBathrooms || currentContact?.buildingSqft) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {currentContact?.propertyType && (
                    <div>
                      <span className="text-gray-500 text-xs">Type</span>
                      <p className="font-medium">{currentContact.propertyType}</p>
                    </div>
                  )}
                  {currentContact?.bedrooms && (
                    <div>
                      <span className="text-gray-500 text-xs">Bedrooms</span>
                      <p className="font-medium">{currentContact.bedrooms}</p>
                    </div>
                  )}
                  {currentContact?.totalBathrooms && (
                    <div>
                      <span className="text-gray-500 text-xs">Bathrooms</span>
                      <p className="font-medium">{currentContact.totalBathrooms}</p>
                    </div>
                  )}
                  {currentContact?.buildingSqft && (
                    <div>
                      <span className="text-gray-500 text-xs">Sq Ft</span>
                      <p className="font-medium">{currentContact.buildingSqft.toLocaleString()}</p>
                    </div>
                  )}
                  {currentContact?.effectiveYearBuilt && (
                    <div>
                      <span className="text-gray-500 text-xs">Year Built</span>
                      <p className="font-medium">{currentContact.effectiveYearBuilt}</p>
                    </div>
                  )}
                  {currentContact?.estValue && (
                    <div>
                      <span className="text-gray-500 text-xs">Est. Value</span>
                      <p className="font-medium text-green-600">${currentContact.estValue.toLocaleString()}</p>
                    </div>
                  )}
                  {currentContact?.estEquity && (
                    <div>
                      <span className="text-gray-500 text-xs">Est. Equity</span>
                      <p className="font-medium text-blue-600">${currentContact.estEquity.toLocaleString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Multiple Properties Section */}
            {currentContact?.properties && currentContact.properties.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600" />
                    Properties Owned ({currentContact.properties.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {currentContact.properties.map((prop: any, idx: number) => (
                    <div
                      key={prop.id || idx}
                      className="p-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                    >
                      <p className="font-medium text-gray-900">{prop.address || '—'}</p>
                      <p className="text-xs text-gray-600">
                        {[prop.city, prop.state].filter(Boolean).join(', ') || '—'}
                      </p>
                      {prop.llcName && (
                        <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {prop.llcName}
                        </p>
                      )}
                      <div className="flex gap-2 mt-1 text-xs text-gray-500">
                        {prop.bedrooms && <span>{prop.bedrooms} bed</span>}
                        {prop.totalBathrooms && <span>• {prop.totalBathrooms} bath</span>}
                        {prop.propertyType && <span>• {prop.propertyType}</span>}
                      </div>
                      {prop.estValue && (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          ${prop.estValue.toLocaleString()}
                          {prop.estEquity && (
                            <span className="text-gray-500 ml-1">
                              (Equity: ${prop.estEquity.toLocaleString()})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {currentContact?.tags && currentContact.tags.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {currentContact.tags.map((tag: any) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tasks Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTasks ? (
                  <div className="text-center py-4 text-gray-500 text-sm">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">No tasks assigned</div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-2 rounded-lg border text-sm ${
                          task.status === 'completed' ? 'bg-green-50 border-green-200' :
                          task.status === 'open' ? 'bg-blue-50 border-blue-200' :
                          'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{task.subject}</div>
                            {task.description && (
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{task.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {task.priority && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  task.priority === 'high' ? 'border-red-500 text-red-600' :
                                  task.priority === 'medium' ? 'border-orange-500 text-orange-600' :
                                  'border-gray-300 text-gray-600'
                                }`}
                              >
                                {task.priority}
                              </Badge>
                            )}
                            <Badge
                              variant={task.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {task.status}
                            </Badge>
                          </div>
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.dueDate), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Activity History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading activities...</div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No activities yet</div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className={`p-3 rounded-lg border ${getActivityColor(activity.type)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm text-gray-900">{activity.title}</h4>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {activity.type}
                              </Badge>
                            </div>
                            {activity.description && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                {activity.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              {activity.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(activity.dueDate), 'MMM d, yyyy')}
                                </span>
                              )}
                              <Badge
                                variant={activity.status === 'completed' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {activity.status}
                              </Badge>
                              {activity.priority && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    activity.priority === 'urgent' ? 'border-red-500 text-red-600' :
                                    activity.priority === 'high' ? 'border-orange-500 text-orange-600' :
                                    'border-gray-300 text-gray-600'
                                  }`}
                                >
                                  {activity.priority}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes Section */}
            {currentContact?.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentContact.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Edit Contact Dialog */}
      {currentContact && (
        <EditContactDialog
          contact={currentContact}
          open={showEditDialog}
          onOpenChange={handleEditDialogChange}
        />
      )}
    </>
  )
}


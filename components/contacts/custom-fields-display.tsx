"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Calendar, DollarSign, Link as LinkIcon, Mail, Phone, CheckCircle, XCircle } from "lucide-react"
import type { Contact } from "@/lib/types"

interface FieldDefinition {
  id: string
  name: string
  fieldKey: string
  fieldType: string
  category?: string
  isSystem: boolean
}

interface CustomFieldsDisplayProps {
  contact: Contact
  compact?: boolean
}

export default function CustomFieldsDisplay({ contact, compact = false }: CustomFieldsDisplayProps) {
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fields')
      .then(res => res.json())
      .then(data => {
        // Only show custom fields (non-system fields)
        const customFields = data.filter((f: FieldDefinition) => !f.isSystem)
        setFieldDefinitions(customFields)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Custom Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  const customFieldsData = contact.customFields || {}
  const fieldsWithValues = fieldDefinitions.filter(field => 
    customFieldsData[field.fieldKey] !== undefined && 
    customFieldsData[field.fieldKey] !== null &&
    customFieldsData[field.fieldKey] !== ''
  )

  if (fieldsWithValues.length === 0) {
    return null // Don't show the card if there are no custom fields with values
  }

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'date':
      case 'datetime':
        return <Calendar className="h-4 w-4 text-blue-600" />
      case 'currency':
      case 'decimal':
      case 'number':
        return <DollarSign className="h-4 w-4 text-green-600" />
      case 'url':
        return <LinkIcon className="h-4 w-4 text-indigo-600" />
      case 'email':
        return <Mail className="h-4 w-4 text-purple-600" />
      case 'phone':
        return <Phone className="h-4 w-4 text-blue-600" />
      case 'boolean':
        return customFieldsData[fieldType] ? 
          <CheckCircle className="h-4 w-4 text-green-600" /> : 
          <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Sparkles className="h-4 w-4 text-purple-600" />
    }
  }

  const formatFieldValue = (value: any, fieldType: string) => {
    if (value === null || value === undefined) return '—'
    
    switch (fieldType) {
      case 'boolean':
        return value ? 'Yes' : 'No'
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'datetime':
        return new Date(value).toLocaleString()
      case 'currency':
        return `$${Number(value).toLocaleString()}`
      case 'decimal':
      case 'number':
        return Number(value).toLocaleString()
      case 'multiselect':
        return Array.isArray(value) ? value.join(', ') : value
      case 'url':
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {value}
          </a>
        )
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
            {value}
          </a>
        )
      case 'phone':
        return (
          <a href={`tel:${value}`} className="text-blue-600 hover:underline">
            {value}
          </a>
        )
      default:
        return String(value)
    }
  }

  // Group fields by category
  const fieldsByCategory = fieldsWithValues.reduce((acc, field) => {
    const category = field.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(field)
    return acc
  }, {} as Record<string, FieldDefinition[]>)

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Custom Fields
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(fieldsByCategory).map(([category, fields]) => (
          <div key={category}>
            {Object.keys(fieldsByCategory).length > 1 && (
              <Badge variant="outline" className="mb-2 text-xs">
                {category}
              </Badge>
            )}
            <div className="space-y-3">
              {fields.map(field => (
                <div key={field.id} className="flex items-start gap-2">
                  {getFieldIcon(field.fieldType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">{field.name}</p>
                    <p className="text-sm font-medium text-gray-900 break-words">
                      {formatFieldValue(customFieldsData[field.fieldKey], field.fieldType)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}


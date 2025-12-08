"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useContacts } from "@/lib/context/contacts-context"
import { useProcessStatus } from "@/lib/context/process-context"
import type { Contact, ColumnMapping } from "@/lib/types"
import { useState, useEffect } from "react"

interface CsvPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  csvData: string[][]
  fileName: string
}

const CONTACT_FIELDS = [
  { label: "Ignore Column", value: "ignore" },
  { label: "Full Name (First & Last)", value: "fullName" },
  { label: "First Name", value: "firstName" },
  { label: "Last Name", value: "lastName" },
  { label: "LLC Name", value: "llcName" },
  { label: "Phone 1", value: "phone1" },
  { label: "Phone 2", value: "phone2" },
  { label: "Phone 3", value: "phone3" },
  { label: "Email 1", value: "email1" },
  { label: "Email 2", value: "email2" },
  { label: "Email 3", value: "email3" },
  { label: "Property Address", value: "propertyAddress" },
  { label: "Contact Address", value: "contactAddress" },
  { label: "City", value: "city" },
  { label: "State", value: "state" },
  { label: "Zip Code", value: "zipCode" },
  { label: "Property County", value: "propertyCounty" },
  { label: "Property Type", value: "propertyType" },
  { label: "Bedrooms", value: "bedrooms" },
  { label: "Total Bathrooms", value: "totalBathrooms" },
  { label: "Building Sqft", value: "buildingSqft" },
  { label: "Effective Year Built", value: "effectiveYearBuilt" },
  { label: "Estimated Value", value: "estValue" },
  { label: "Debt Owed", value: "debtOwed" },
  { label: "Estimated Equity", value: "estEquity" },
  { label: "DNC", value: "dnc" },
  { label: "DNC Reason", value: "dncReason" },
  { label: "Notes", value: "notes" },
  { label: "Deal Status", value: "dealStatus" },
  { label: "LinkedIn URL", value: "linkedinUrl" },
]

const PROPERTY_TYPE_MAP: { [key: string]: Contact["propertyType"] } = {
  "single family": "Single Family",
  sfh: "Single Family",
  duplex: "Duplex",
  triplex: "Triplex",
  quadplex: "Quadplex",
  "multi family 5+": "Multi Family 5+",
  "multi-family": "Multi Family 5+",
  condo: "Condo",
  townhouse: "Townhouse",
  land: "Land",
  commercial: "Commercial",
  other: "Other",
}

const DEAL_STATUS_MAP: { [key: string]: Contact["dealStatus"] } = {
  lead: "lead",
  "credit run": "credit_run",
  credit_run: "credit_run",
  "document collection": "document_collection",
  document_collection: "document_collection",
  processing: "processing",
  "appraisal fee": "appraisal_fee",
  appraisal_fee: "appraisal_fee",
  underwriting: "underwriting",
  closing: "closing",
  funded: "funded",
  lost: "lost",
}

export default function CsvPreview({ open, onOpenChange, csvData, fileName }: CsvPreviewProps) {
  const { addContact, contacts } = useContacts()
  const { toast } = useToast()
  const { startProcess, updateProcess, completeProcess, failProcess } = useProcessStatus()

  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [skipHeaderRow, setSkipHeaderRow] = useState(true)

  useEffect(() => {
    if (csvData && csvData.length > 0) {
      const effectiveHeaders = skipHeaderRow ? csvData[0] : csvData[0].map((_, i) => `Column ${i + 1}`)
      setHeaders(effectiveHeaders)
      setPreviewRows(csvData.slice(skipHeaderRow ? 1 : 0, 5)) // Show first 5 data rows

      // Initialize column mappings based on inferred headers or default to ignore
      const initialMappings: ColumnMapping[] = effectiveHeaders.map((header) => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "")
        const matchedField = CONTACT_FIELDS.find(
          (field) =>
            field.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedHeader ||
            field.value.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedHeader,
        )
        return {
          csvHeader: header,
          dbField: matchedField ? (matchedField.value as keyof Contact | "fullName" | "ignore") : "ignore",
        }
      })
      setColumnMappings(initialMappings)
    }
  }, [csvData, skipHeaderRow])

  const handleMappingChange = (csvHeader: string, dbField: keyof Contact | "fullName" | "ignore") => {
    setColumnMappings((prev) =>
      prev.map((mapping) => (mapping.csvHeader === csvHeader ? { ...mapping, dbField } : mapping)),
    )
  }

  const normalizePhoneNumber = (phone: string) => {
    if (!phone) return undefined
    const digits = phone.replace(/\D/g, "")
    // Basic validation: must be at least 7 digits (local) or 10 digits (with area code)
    if (digits.length >= 7) {
      return digits
    }
    return undefined
  }

  const normalizeEmail = (email: string) => {
    if (!email) return undefined
    // Basic email regex for format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (emailRegex.test(email)) {
      return email.toLowerCase()
    }
    return undefined
  }

  const normalizePropertyType = (type: string) => {
    if (!type) return undefined
    const normalized = type
      .toLowerCase()
      .replace(/[^a-z0-9+]/g, "")
      .replace(/\s/g, "")
    return PROPERTY_TYPE_MAP[normalized] || "Other" // Default to "Other" if not found
  }

  const normalizeDealStatus = (status: string) => {
    if (!status) return "lead" // Default to 'lead'
    const normalized = status.toLowerCase().replace(/[^a-z0-9]/g, "")
    return DEAL_STATUS_MAP[normalized] || "lead" // Default to 'lead' if not found
  }

  const handleImport = async () => {
    const dataRows = skipHeaderRow ? csvData.slice(1) : csvData
    const totalRows = dataRows.length
    let importedCount = 0
    let skippedCount = 0
    let duplicateCount = 0
    const processId = `csv-upload-${Date.now()}`

    startProcess(processId, "csv_upload", "Processing CSV import...", 0)

    for (let i = 0; i < totalRows; i++) {
      const row = dataRows[i]
      const newContact: Partial<Contact> = {
        tags: [], // Initialize tags
        dnc: false, // Default DNC to false
        dealStatus: "lead", // Default deal status
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      let hasPhoneOrEmail = false
      const currentPhoneNumbers: string[] = []
      const currentEmails: string[] = []

      columnMappings.forEach((mapping, index) => {
        const value = row[index]?.trim() || ""

        if (mapping.dbField === "ignore" || !value) {
          return
        }

        if (mapping.dbField === "fullName") {
          const parts = value.split(/\s+/)
          newContact.firstName = parts[0]
          newContact.lastName = parts.slice(1).join(" ") || ""
        } else if (mapping.dbField.startsWith("phone")) {
          const normalizedPhone = normalizePhoneNumber(value)
          if (normalizedPhone) {
            ;(newContact[mapping.dbField] as string) = normalizedPhone
            currentPhoneNumbers.push(normalizedPhone)
            hasPhoneOrEmail = true
          }
        } else if (mapping.dbField.startsWith("email")) {
          const normalizedEmail = normalizeEmail(value)
          if (normalizedEmail) {
            ;(newContact[mapping.dbField] as string) = normalizedEmail
            currentEmails.push(normalizedEmail)
            hasPhoneOrEmail = true
          }
        } else if (mapping.dbField === "propertyType") {
          newContact.propertyType = normalizePropertyType(value)
        } else if (mapping.dbField === "dealStatus") {
          newContact.dealStatus = normalizeDealStatus(value)
        } else if (mapping.dbField === "dnc") {
          newContact.dnc = value.toLowerCase() === "true" || value.toLowerCase() === "yes" || value === "1"
        } else if (mapping.dbField === "linkedinUrl") {
          // Normalize LinkedIn URL
          let linkedinUrl = value.trim()
          if (linkedinUrl && !linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
            linkedinUrl = 'https://' + linkedinUrl
          }
          // Only store if it looks like a LinkedIn URL
          if (linkedinUrl && linkedinUrl.toLowerCase().includes('linkedin.com')) {
            newContact.linkedinUrl = linkedinUrl
          }
        } else if (
          [
            "bedrooms",
            "totalBathrooms",
            "buildingSqft",
            "effectiveYearBuilt",
            "estValue",
            "debtOwed",
            "estEquity",
          ].includes(mapping.dbField)
        ) {
          const numValue = Number.parseFloat(value)
          if (!Number.isNaN(numValue)) {
            ;(newContact as Record<string, unknown>)[mapping.dbField] = numValue
          }
        } else {
          ;(newContact[mapping.dbField] as string) = value
        }
      })

      // Skip row if no valid phone or email is found
      if (!hasPhoneOrEmail) {
        skippedCount++
        updateProcess(processId, {
          progress: ((i + 1) / totalRows) * 100,
          message: `Processing row ${i + 1}/${totalRows}... Skipped (no phone/email).`,
        })
        continue
      }

      // Check for duplicates based on phone numbers or emails
      const isDuplicate = contacts.some((existingContact) => {
        const existingPhones = [existingContact.phone1, existingContact.phone2, existingContact.phone3].filter(Boolean)
        const existingEmails = [existingContact.email1, existingContact.email2, existingContact.email3].filter(Boolean)

        const phoneMatch = currentPhoneNumbers.some((newPhone) => existingPhones.includes(newPhone))
        const emailMatch = currentEmails.some((newEmail) => existingEmails.includes(newEmail))

        return phoneMatch || emailMatch
      })

      if (isDuplicate) {
        duplicateCount++
        updateProcess(processId, {
          progress: ((i + 1) / totalRows) * 100,
          message: `Processing row ${i + 1}/${totalRows}... Skipped (duplicate).`,
        })
        continue
      }

      // Ensure firstName and lastName are set, even if from fullName or default
      if (!newContact.firstName && !newContact.lastName) {
        // If fullName was not mapped or was empty, try to infer from other fields or default
        newContact.firstName = currentEmails[0] || currentPhoneNumbers[0] || "Unknown"
        newContact.lastName = "Contact"
      } else if (!newContact.firstName) {
        newContact.firstName = newContact.lastName || "Unknown"
        newContact.lastName = ""
      } else if (!newContact.lastName) {
        newContact.lastName = "Contact"
      }

      addContact(newContact as Contact)
      importedCount++
      updateProcess(processId, {
        progress: ((i + 1) / totalRows) * 100,
        message: `Processing row ${i + 1}/${totalRows}... Imported.`,
      })
      await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay to show progress
    }

    completeProcess(
      processId,
      `CSV import complete! Imported ${importedCount} contacts, skipped ${skippedCount} rows, ${duplicateCount} duplicates found.`,
    )
    toast({
      title: "Import Complete",
      description: `Successfully imported ${importedCount} contacts. ${skippedCount} rows skipped (missing phone/email). ${duplicateCount} duplicates found and skipped.`,
      duration: 5000,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview & Map CSV: {fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="skipHeader"
            checked={skipHeaderRow}
            onCheckedChange={(checked: boolean) => setSkipHeaderRow(checked)}
          />
          <Label htmlFor="skipHeader">First row is header</Label>
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full w-full border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((header, index) => (
                    <TableHead key={index} className="min-w-[150px]">
                      <div className="font-bold text-sm mb-1">{header}</div>
                      <Select
                        value={columnMappings[index]?.dbField || "ignore"}
                        onValueChange={(value: keyof Contact | "fullName" | "ignore") =>
                          handleMappingChange(header, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Map to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport}>Import Contacts</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

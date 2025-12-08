"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useContacts } from "@/lib/context/contacts-context"
import type { Contact, ColumnMapping } from "@/lib/types"
import { CsvPreview } from "./csv-preview"
import Papa from "papaparse"

interface CsvUploaderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CsvUploader({ open, onOpenChange }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([])
  const [step, setStep] = useState(1) // 1: Upload, 2: Map, 3: Preview, 4: Processing
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingMessage, setProcessingMessage] = useState("")
  const { addContact, contacts } = useContacts()
  const { toast } = useToast()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0]
      setFile(selectedFile)
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvData(results.data)
          const headers = results.meta.fields || []
          setCsvHeaders(headers)
          // Initialize mappings with default "ignore"
          setColumnMappings(
            headers.map((header) => ({
              csvHeader: header,
              dbField: "ignore",
            })),
          )
          setStep(2) // Move to mapping step
        },
        error: (error) => {
          toast({
            title: "Error parsing CSV",
            description: error.message,
            variant: "destructive",
          })
          setFile(null)
          setCsvData(null)
          setCsvHeaders([])
          setColumnMappings([])
          setStep(1)
        },
      })
    }
  }

  const handleMappingChange = (csvHeader: string, dbField: ColumnMapping["dbField"]) => {
    setColumnMappings((prevMappings) =>
      prevMappings.map((mapping) => (mapping.csvHeader === csvHeader ? { ...mapping, dbField } : mapping)),
    )
  }

  const handleNextToPreview = () => {
    setStep(3) // Move to preview step
  }

  const normalizePropertyType = (type?: string): Contact["propertyType"] | undefined => {
    if (!type) return undefined
    const lowerType = type.toLowerCase().trim()

    // Duplex - "Duplex (2 units, any combination)" -> "Duplex"
    if (lowerType.includes("duplex") || lowerType.includes("2 unit") || lowerType.includes("(2 units")) return "Duplex"
    if (lowerType.includes("triplex") || lowerType.includes("3 unit")) return "Triplex"
    if (lowerType.includes("quadplex") || lowerType.includes("4 unit")) return "Quadplex"

    // Condo - "Condominium (Residential)" -> "Condo"
    if (lowerType.includes("condo")) return "Condo"

    // Multi-Family 2+ units - "Multi-Family Dwellings (Generic, 2+)" -> "Multi-Family 2+ units"
    if (lowerType.includes("multi-family dwellings") || lowerType.includes("generic, 2+") ||
        (lowerType.includes("multi") && lowerType.includes("family") && lowerType.includes("2+")))
      return "Multi-Family 2+ units"

    // Multi Family 5+
    if (lowerType.includes("multi-family") || lowerType.includes("multi family") || lowerType.includes("5+"))
      return "Multi Family 5+"

    // Single-Fam - "Single Family Residential" -> "Single-Fam"
    if (lowerType.includes("single family")) return "Single-Fam"

    if (lowerType.includes("townhouse")) return "Townhouse"
    if (lowerType.includes("land")) return "Land"
    if (lowerType.includes("commercial")) return "Commercial"
    return "Other"
  }

  const processContacts = useCallback(async () => {
    if (!csvData) return

    setStep(4) // Move to processing step
    setProcessingProgress(0)
    setProcessingMessage("Starting import...")

    const newContacts: Contact[] = []
    const skippedRows: { row: number; reason: string }[] = []
    const existingContactMap = new Map<string, Contact>() // For quick lookup of existing contacts
    contacts.forEach((c) => {
      const key = `${c.firstName?.toLowerCase()}-${c.lastName?.toLowerCase()}-${c.phone1}`
      existingContactMap.set(key, c)
    })

    const uploadedContactKeys = new Set<string>() // To track duplicates within the uploaded file

    for (let i = 0; i < csvData.length; i++) {
      setProcessingProgress(Math.round(((i + 1) / csvData.length) * 100))
      setProcessingMessage(`Processing row ${i + 1} of ${csvData.length}...`)

      const row = csvData[i]
      const newContact: Partial<Contact> = {
        id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tags: [], // Initialize tags as empty array
        dnc: false, // Default DNC to false
        dealStatus: "lead", // Default deal status
      }

      let hasPhoneNumber = false
      let currentFullName: string | undefined

      for (const mapping of columnMappings) {
        const value = row[mapping.csvHeader]
        if (value === undefined || value === null || value === "") {
          continue
        }

        switch (mapping.dbField) {
          case "fullName":
            currentFullName = String(value)
            break
          case "firstName":
          case "lastName":
          case "llcName":
          case "propertyAddress":
          case "city":
          case "state":
          case "propertyCounty":
          case "dncReason":
          case "notes":
          case "avatarUrl":
            ;(newContact as Record<string, unknown>)[mapping.dbField] = String(value)
            break
          case "phone1":
          case "phone2":
          case "phone3":
            ;(newContact as Record<string, unknown>)[mapping.dbField] = String(value).replace(/\D/g, "") // Clean phone number
            hasPhoneNumber = true
            break
          case "email1":
          case "email2":
          case "email3":
            ;(newContact as Record<string, unknown>)[mapping.dbField] = String(value).toLowerCase()
            break
          case "linkedinUrl":
            // Normalize LinkedIn URL
            let linkedinUrl = String(value).trim()
            if (linkedinUrl && !linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
              linkedinUrl = 'https://' + linkedinUrl
            }
            if (linkedinUrl && linkedinUrl.toLowerCase().includes('linkedin.com')) {
              ;(newContact as Record<string, unknown>)[mapping.dbField] = linkedinUrl
            }
            break
          case "propertyType":
            newContact.propertyType = normalizePropertyType(value)
            break
          case "bedrooms":
          case "totalBathrooms":
          case "buildingSqft":
          case "effectiveYearBuilt":
            ;(newContact as Record<string, unknown>)[mapping.dbField] = Number.parseInt(String(value), 10) || undefined
            break
          case "estValue":
          case "debtOwed":
          case "estEquity":
            ;(newContact as Record<string, unknown>)[mapping.dbField] =
              Number.parseFloat(String(value).replace(/[^0-9.-]+/g, "")) || undefined
            break
          case "dealStatus":
            const normalizedDealStatus = String(value).toLowerCase().replace(/ /g, "_")
            const validDealStatuses: Contact["dealStatus"][] = [
              "lead",
              "credit_run",
              "document_collection",
              "processing",
              "appraisal_fee",
              "underwriting",
              "closing",
              "funded",
              "lost",
            ]
            if (validDealStatuses.includes(normalizedDealStatus as Contact["dealStatus"])) {
              newContact.dealStatus = normalizedDealStatus as Contact["dealStatus"]
            }
            break
          case "dnc":
            newContact.dnc = String(value).toLowerCase() === "true" || String(value) === "1"
            break
          // Tags are handled separately if a specific tag column is mapped
          case "ignore":
          default:
            break
        }
      }

      // Handle full name splitting if 'fullName' was mapped
      if (currentFullName && !newContact.firstName && !newContact.lastName) {
        const nameParts = currentFullName.split(" ")
        newContact.firstName = nameParts[0] || undefined
        newContact.lastName = nameParts.slice(1).join(" ") || undefined
      }

      // Validate phone number presence
      if (!hasPhoneNumber && !newContact.email1 && !newContact.email2 && !newContact.email3) {
        skippedRows.push({ row: i + 1, reason: "No phone number or email found" })
        continue
      }

      // De-duplication logic
      const contactKey = `${newContact.firstName?.toLowerCase()}-${newContact.lastName?.toLowerCase()}-${newContact.phone1}`
      const uploadedContactKeyWithAddress = `${contactKey}-${newContact.propertyAddress?.toLowerCase()}`

      // Check for duplicates within the uploaded file
      if (uploadedContactKeys.has(uploadedContactKeyWithAddress)) {
        skippedRows.push({ row: i + 1, reason: "Duplicate entry within uploaded file (Name, Phone, Address)" })
        continue
      }
      uploadedContactKeys.add(uploadedContactKeyWithAddress)

      // Check for duplicates against existing database
      const existingContact = existingContactMap.get(contactKey)
      if (existingContact) {
        // If name and phone are same, but property address is different, add as new contact
        if (
          existingContact.propertyAddress?.toLowerCase() !== newContact.propertyAddress?.toLowerCase() &&
          newContact.propertyAddress
        ) {
          // This is a new property for an existing person, so it should be added as a new contact.
          // We might want to link these later, but for now, they are distinct contacts.
          // The current logic allows it to be uploaded as a new contact.
          // If the user wants to tie it to the same person, that would require a more complex data model
          // (e.g., a 'Person' entity and a 'Property' entity, with a many-to-many relationship).
          // For this current contact-centric model, different property address means a new contact entry.
          newContacts.push(newContact as Contact)
        } else {
          // Exact duplicate (Name, Phone, and Address are the same)
          skippedRows.push({ row: i + 1, reason: "Duplicate entry with existing database (Name, Phone, Address)" })
          continue
        }
      } else {
        // No duplicate found, add as new contact
        newContacts.push(newContact as Contact)
      }
    }

    // Add all new contacts to the global state
    newContacts.forEach((contact) => addContact(contact))

    setProcessingMessage("Import complete!")
    toast({
      title: "CSV Import Complete",
      description: `Successfully imported ${newContacts.length} contacts. Skipped ${skippedRows.length} rows.`,
      duration: 5000,
    })

    if (skippedRows.length > 0) {
      console.warn("Skipped rows details:", skippedRows)
      toast({
        title: "Skipped Rows",
        description: "Some rows were skipped due to validation or duplication. Check console for details.",
        variant: "destructive",
        duration: 7000,
      })
    }

    // Reset state and close dialog
    setTimeout(() => {
      setFile(null)
      setCsvData(null)
      setCsvHeaders([])
      setColumnMappings([])
      setStep(1)
      onOpenChange(false)
    }, 2000)
  }, [csvData, contacts, addContact, onOpenChange, toast, columnMappings])

  const handleClose = () => {
    setFile(null)
    setCsvData(null)
    setCsvHeaders([])
    setColumnMappings([])
    setStep(1)
    onOpenChange(false)
  }

  const getDbFields = () => {
    return [
      { value: "ignore", label: "Ignore Column" },
      { value: "firstName", label: "First Name" },
      { value: "lastName", label: "Last Name" },
      { value: "llcName", label: "LLC Name" },
      { value: "phone1", label: "Phone 1" },
      { value: "phone2", label: "Phone 2" },
      { value: "phone3", label: "Phone 3" },
      { value: "email1", label: "Email 1" },
      { value: "email2", label: "Email 2" },
      { value: "email3", label: "Email 3" },
      { value: "propertyAddress", label: "Property Address" },
      { value: "contactAddress", label: "Contact Address" },
      { value: "city", label: "City" },
      { value: "state", label: "State" },
      { value: "propertyCounty", label: "Property County" },
      { value: "propertyType", label: "Property Type" },
      { value: "bedrooms", label: "Bedrooms" },
      { value: "totalBathrooms", label: "Total Bathrooms" },
      { value: "buildingSqft", label: "Building Sqft" },
      { value: "effectiveYearBuilt", label: "Effective Year Built" },
      { value: "estValue", label: "Estimated Value" },
      { value: "debtOwed", label: "Debt Owed" },
      { value: "estEquity", label: "Estimated Equity" },
      { value: "dnc", label: "DNC (Do Not Call)" },
      { value: "dncReason", label: "DNC Reason" },
      { value: "notes", label: "Notes" },
      { value: "dealStatus", label: "Deal Status" },
      { value: "avatarUrl", label: "Avatar URL" },
      { value: "linkedinUrl", label: "LinkedIn URL" },
    ]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Contacts from CSV/Excel</DialogTitle>
          <DialogDescription>
            {step === 1 && "Upload your CSV or Excel file to import contacts."}
            {step === 2 && "Map your CSV columns to our database fields."}
            {step === 3 && "Review the contacts before importing."}
            {step === 4 && "Processing your contacts..."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4 py-4">
            <Label htmlFor="file">Choose File</Label>
            <Input id="file" type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
            <p className="text-sm text-muted-foreground">Supported formats: CSV, XLSX, XLS. Max file size: 10MB.</p>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 py-4 overflow-y-auto">
            <p className="text-sm text-muted-foreground">Match your CSV headers to the appropriate database fields.</p>
            {csvHeaders.map((header) => (
              <div key={header} className="grid grid-cols-2 items-center gap-4">
                <Label htmlFor={`map-${header}`}>{header}</Label>
                <Select
                  value={columnMappings.find((m) => m.csvHeader === header)?.dbField || "ignore"}
                  onValueChange={(value: ColumnMapping["dbField"]) => handleMappingChange(header, value)}
                >
                  <SelectTrigger id={`map-${header}`}>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {getDbFields().map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {step === 3 && csvData && (
          <div className="flex-1 overflow-hidden">
            <CsvPreview data={csvData} mappings={columnMappings} />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4 py-4">
            <Progress value={processingProgress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">{processingMessage}</p>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-4">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={step === 4}>
              Cancel
            </Button>
            {step === 2 && (
              <Button onClick={handleNextToPreview} disabled={columnMappings.length === 0}>
                Next: Preview
              </Button>
            )}
            {step === 3 && (
              <Button onClick={processContacts} disabled={!csvData || processingProgress > 0}>
                Import Contacts
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

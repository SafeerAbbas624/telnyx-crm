"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FileText, DollarSign, Calendar, User, Home, Phone, Mail, Plus, Send, AlertCircle, TrendingUp, Filter } from "lucide-react"
import { useLoanStore } from "@/lib/stores/useLoanStore"
import { useDealsStore } from "@/lib/stores/useDealsStore"
import { formatCurrency } from "@/lib/stores/currency"
import LoanDetailsTab from "./loan-details-tab"
import LoanDocumentsTab from "./loan-documents-tab"
import LoanContactsTab from "./loan-contacts-tab"
import LoanEmailTab from "./loan-email-tab"
import LoanAITab from "./loan-ai-tab"
import LoanNotesTab from "./loan-notes-tab"
import LoanTasksTab from "./loan-tasks-tab"
import NewLoanDialog from "./new-loan-dialog"
import AddContactDialog from "./add-contact-dialog"
import AdvancedSearchFilter from "./advanced-search-filter"
import FunderManagementDialog from "./funder-management-dialog"

export default function LoanCoPilot() {
  const {
    loans,
    loanPipelines,
    addDocument,
    getDocumentsByLoan,
    getContactsByLoan,
    addFrequentContact,
    addContact,
    createLoan,
    emailTemplates,
    populateTemplate,
  } = useLoanStore()

  const { addTaskToDeal, updateTask, deleteTask } = useDealsStore()

  const [activeLoanId, setActiveLoanId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("details")
  const [showNewLoanDialog, setShowNewLoanDialog] = useState(false)
  const [showAddContactDialog, setShowAddContactDialog] = useState(false)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [showFunderManagement, setShowFunderManagement] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredLoans, setFilteredLoans] = useState(loans)
  const [funders, setFunders] = useState<any[]>([])
  const activeLoan = useMemo(() => filteredLoans.find(l => l.id === activeLoanId) || filteredLoans[0], [filteredLoans, activeLoanId])

  useEffect(() => {
    if (loans.length && !activeLoanId) setActiveLoanId(loans[0].id)
  }, [loans, activeLoanId])

  // Load funders from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('adler-capital-funders')
      if (stored) {
        setFunders(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load funders:', error)
    }
  }, [])

  // Handle search and filter
  const handleSearch = (filters: any) => {
    let results = loans

    if (searchQuery) {
      results = results.filter(loan =>
        loan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.borrowerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.propertyAddress?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (filters.borrowerName) {
      results = results.filter(loan =>
        loan.borrowerName?.toLowerCase().includes(filters.borrowerName.toLowerCase())
      )
    }

    if (filters.propertyAddress) {
      results = results.filter(loan =>
        loan.propertyAddress?.toLowerCase().includes(filters.propertyAddress.toLowerCase())
      )
    }

    if (filters.loanAmount) {
      results = results.filter(loan => {
        const amount = loan.loanData?.loanAmount || 0
        return amount >= (filters.loanAmount.min || 0) && amount <= (filters.loanAmount.max || Infinity)
      })
    }

    if (filters.loanStatus) {
      results = results.filter(loan => loan.status === filters.loanStatus)
    }

    if (filters.dscr) {
      results = results.filter(loan => {
        const dscr = loan.loanData?.dscr || 0
        return dscr >= (filters.dscr.min || 0) && dscr <= (filters.dscr.max || Infinity)
      })
    }

    if (filters.ltv) {
      results = results.filter(loan => {
        const ltv = loan.ltv || 0
        return ltv >= (filters.ltv.min || 0) && ltv <= (filters.ltv.max || Infinity)
      })
    }

    setFilteredLoans(results)
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setFilteredLoans(loans)
  }

  const docs = activeLoan ? getDocumentsByLoan(activeLoan.id) : []
  const contacts = activeLoan ? getContactsByLoan(activeLoan.id) : []

  // Get funder documents for the active loan
  const getFunderDocuments = () => {
    if (!activeLoan) return undefined
    try {
      const stored = localStorage.getItem('adler-capital-funders')
      if (stored) {
        const funders = JSON.parse(stored)
        const funder = funders.find((f: any) => f.id === activeLoan.lender)
        return funder?.requiredDocuments
      }
    } catch (error) {
      console.error('Failed to get funder documents:', error)
    }
    return undefined
  }

  const addSampleDoc = () => {
    if (!activeLoan) return
    addDocument({
      loanId: activeLoan.id,
      fileName: `application_${Date.now()}.pdf`,
      fileType: 'application/pdf',
      fileSize: 250000,
      category: 'Application',
      status: 'Uploaded',
      uploadedBy: 'user-1',
      notes: 'Sample upload',
      isRequired: true,
    })
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Co-Pilot</h1>
            <p className="text-muted-foreground">Process DSCR loans and manage documents</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Send className="mr-2 h-4 w-4" /> Send to Analyst
          </Button>
        </div>

        {/* Loan Header with Key Metrics */}
        {activeLoan && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg">
                  {getInitials(activeLoan.borrowerName)}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{activeLoan.borrowerName}</h2>
                  <p className="text-sm text-muted-foreground">{activeLoan.propertyAddress}, {activeLoan.propertyCity}, {activeLoan.propertyState}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="font-semibold">Lender: <span className="text-blue-600">{activeLoan.lender || 'TBD'}</span></span>
                    <span className="font-semibold">Type: <span className="text-blue-600">{activeLoan.loanType}</span></span>
                    <span className="font-semibold">Amount: <span className="text-blue-600">{formatCurrency(activeLoan.loanAmount)}</span></span>
                    <span className="font-semibold">LTV: <span className="text-blue-600">{activeLoan.ltv?.toFixed(2)}%</span></span>
                  </div>
                </div>
              </div>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={activeLoan?.id || ""}
                onChange={(e) => setActiveLoanId(e.target.value)}
              >
                {loans.map(l => (
                  <option key={l.id} value={l.id}>{l.borrowerName}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar - Loan List */}
        <div className="w-80 border-r bg-slate-50 flex flex-col">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Loans</h3>
              <Badge variant="outline">{filteredLoans.length}</Badge>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search loans..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  handleSearch({})
                }}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setShowAdvancedSearch(true)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Button size="sm" className="w-full" variant="outline" onClick={() => setShowNewLoanDialog(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Loan
              </Button>
              <Button size="sm" className="w-full" variant="outline" onClick={() => setShowFunderManagement(true)}>
                <Plus className="mr-2 h-4 w-4" /> Manage Funders
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {filteredLoans.map(loan => (
                <div
                  key={loan.id}
                  onClick={() => setActiveLoanId(loan.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    activeLoanId === loan.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-sm">{loan.borrowerName}</div>
                  <div className="text-xs text-muted-foreground">{loan.propertyAddress}</div>
                  <div className="text-xs text-muted-foreground mt-1">{formatCurrency(loan.loanAmount)}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeLoan ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No loans found. Create a new loan to get started.
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b px-6 pt-4">
                <TabsList className="grid w-full grid-cols-7 max-w-3xl">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="emails">Emails</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="ai">AI Assistant</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-auto">
                {/* Details Tab */}
                <TabsContent value="details" className="p-6">
                  <LoanDetailsTab
                    loan={activeLoan}
                    onUpdate={(updates) => {
                      // Update loan in store
                      console.log('Update loan:', updates)
                    }}
                    onCreateTask={(taskData) => {
                      addTaskToDeal(activeLoan.id, {
                        title: taskData.title,
                        dueDate: taskData.dueDate,
                        completed: false,
                      })
                    }}
                  />
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="p-6">
                  <LoanDocumentsTab
                    loanId={activeLoan.id}
                    documents={docs}
                    onUpload={addSampleDoc}
                    onDelete={(docId) => console.log('Delete doc:', docId)}
                    funderRequiredDocuments={getFunderDocuments()}
                  />
                </TabsContent>

                {/* Contacts Tab */}
                <TabsContent value="contacts" className="p-6">
                  <LoanContactsTab
                    loanId={activeLoan.id}
                    contacts={contacts}
                    onAddContact={(contact) => console.log('Add contact:', contact)}
                    onDeleteContact={(contactId) => console.log('Delete contact:', contactId)}
                    onAddFrequent={(contact) => addFrequentContact(activeLoan.id, contact)}
                    onSendBulkEmail={async (recipients, subject, body) => {
                      try {
                        for (const email of recipients) {
                          await fetch('/api/loans/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              to: email,
                              subject,
                              body,
                              loanId: activeLoan.id,
                            }),
                          })
                        }
                      } catch (error) {
                        console.error('Error sending bulk email:', error)
                        throw error
                      }
                    }}
                  />
                </TabsContent>

                {/* Emails Tab */}
                <TabsContent value="emails" className="p-6">
                  <LoanEmailTab
                    loanId={activeLoan.id}
                    templates={emailTemplates}
                    onSendEmail={(to, subject, body) => console.log('Send email:', { to, subject, body })}
                  />
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="p-6">
                  <LoanTasksTab
                    loanId={activeLoan.id}
                    tasks={activeLoan.tasks || []}
                    onToggleTask={(taskId, completed) => {
                      updateTask(activeLoan.id, taskId, { completed })
                    }}
                    onDeleteTask={(taskId) => {
                      deleteTask(activeLoan.id, taskId)
                    }}
                  />
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="p-6">
                  <LoanNotesTab
                    loanId={activeLoan.id}
                    notes={[]}
                    onAddNote={(content) => console.log('Add note:', content)}
                    onDeleteNote={(noteId) => console.log('Delete note:', noteId)}
                    onTogglePinNote={(noteId) => console.log('Toggle pin:', noteId)}
                  />
                </TabsContent>

                {/* AI Assistant Tab */}
                <TabsContent value="ai" className="p-6">
                  <LoanAITab loanId={activeLoan.id} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>

        {/* Right Panel - AI Insights */}
        <div className="w-80 border-l bg-slate-50 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> AI Insights
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Missing Documents */}
              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-sm">Missing Documents</span>
                  <Badge className="ml-auto bg-orange-100 text-orange-800">6</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Tax Returns (2 years)</div>
                  <div>• Bank Statements</div>
                  <div>• Property Appraisal</div>
                  <div>• Insurance Quote</div>
                  <div>• Title Report</div>
                  <div>• Lease Agreements</div>
                </div>
              </div>

              {/* LTV Analysis */}
              <div className="bg-white rounded-lg p-3 border">
                <div className="font-semibold text-sm mb-2">LTV Analysis</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Current LTV:</span>
                    <span className="font-bold text-green-600">{activeLoan?.ltv?.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max LTV:</span>
                    <span>80%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min((activeLoan?.ltv || 0) / 80 * 100, 100)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="bg-white rounded-lg p-3 border">
                <div className="font-semibold text-sm mb-2">Suggestions</div>
                <div className="text-xs text-muted-foreground space-y-2">
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    Request updated tax returns from borrower
                  </div>
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    Schedule property inspection
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Dialogs */}
      <NewLoanDialog
        open={showNewLoanDialog}
        onOpenChange={setShowNewLoanDialog}
        onCreateLoan={(loanData) => {
          try {
            // Get funder name from funder ID
            const selectedFunder = funders.find(f => f.id === loanData.funder)
            const funderName = selectedFunder?.name || loanData.funder || 'TBD'

            createLoan({
              borrowerName: loanData.borrowerName,
              borrowerEmail: '',
              borrowerPhone: '',
              propertyAddress: loanData.propertyAddress,
              propertyCity: '',
              propertyState: '',
              propertyZip: '',
              loanAmount: loanData.loanAmount,
              propertyValue: loanData.estimatedValue,
              ltv: loanData.ltv || ((loanData.loanAmount / loanData.estimatedValue) * 100),
              loanType: loanData.loanType,
              lender: funderName,
              interestRate: 0,
              loanTerm: 30,
              targetCloseDate: loanData.targetCloseDate || new Date().toISOString().split('T')[0],
              status: 'new',
              pipelineId: 'pipeline-2', // Loan Processing pipeline
              monthlyIncome: 0,
              monthlyExpenses: 0,
              monthlyDebtService: 0,
              dscr: 0,
            })
            setShowNewLoanDialog(false)
          } catch (error) {
            console.error("Error creating loan:", error)
          }
        }}
      />

      <AddContactDialog
        open={showAddContactDialog}
        onOpenChange={setShowAddContactDialog}
        onAddContact={(contactData) => {
          try {
            if (activeLoan) {
              addContact({
                loanId: activeLoan.id,
                name: contactData.name,
                email: contactData.email,
                phone: contactData.phone,
                role: contactData.role,
                company: '',
                notes: '',
              })
              setShowAddContactDialog(false)
            }
          } catch (error) {
            console.error("Error adding contact:", error)
          }
        }}
      />

      {/* Advanced Search & Filter Dialog */}
      <AdvancedSearchFilter
        open={showAdvancedSearch}
        onOpenChange={setShowAdvancedSearch}
        onSearch={handleSearch}
        onClear={handleClearFilters}
      />

      {/* Funder Management Dialog */}
      <FunderManagementDialog
        open={showFunderManagement}
        onOpenChange={setShowFunderManagement}
      />
    </div>
  )
}

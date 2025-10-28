import { useState } from 'react';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Checkbox } from './ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useLoanStore } from '../stores/useLoanStore';
import { useTaskStore } from '../stores/useTaskStore';
import { Loan, DocumentCategory, LoanContact, LoanNote, LENDER_REQUIRED_DOCS } from '../types/loans';
import { getRequirementsForFunder, getRequiredDocumentCount, getFunderSpecificDocumentCount } from '../utils/loanDocumentRequirements';
import { LoanDocumentsTab } from './loan-documents-tab';
import {
  FileText,
  Upload,
  Mail,
  Users,
  Settings,
  Bot,
  Search,
  Plus,
  Check,
  Clock,
  AlertCircle,
  ExternalLink,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  Sparkles,
  MessageSquare,
  Calendar,
  Target,
  Building,
  Home,
  DollarSign,
  Percent,
  User,
  Phone,
  MapPin,
  Filter,
  Pencil,
  Trash2,
  Zap,
  Pin,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';
import { formatPhoneNumber, formatNumberWithCommas, parseFormattedNumber } from '../utils/formatting';

// DSCR Calculation Helper
function calculateDSCR(
  loanAmount: number,
  interestRate: number,
  monthlyRent: number,
  annualTaxes: number,
  annualInsurance: number,
  annualHOA: number,
  interestOnly: boolean = false
): number {
  if (!loanAmount || !interestRate || !monthlyRent) return 0;

  // Calculate monthly debt service (mortgage payment)
  let monthlyDebtService: number;
  
  if (interestOnly) {
    // Interest Only: Monthly payment = (Loan Amount × Annual Rate) / 12
    monthlyDebtService = (loanAmount * (interestRate / 100)) / 12;
  } else {
    // Regular amortized loan (30-year assumed)
    // Monthly payment = P × [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = 30 * 12; // 30 years
    monthlyDebtService = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }

  // Calculate annual debt service
  const annualDebtService = monthlyDebtService * 12;

  // Calculate NOI (Net Operating Income)
  const annualIncome = monthlyRent * 12;
  const annualExpenses = (annualTaxes || 0) + (annualInsurance || 0) + (annualHOA || 0);
  const noi = annualIncome - annualExpenses;

  // DSCR = NOI / Annual Debt Service
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;

  return Math.round(dscr * 100) / 100; // Round to 2 decimals
}

export function LoanProcessingModule() {
  const { currentUser } = useAuth();
  const { 
    loans, 
    loanPipelines,
    documents, 
    emailTemplates, 
    contacts,
    notes,
    frequentContacts,
    createLoan, 
    updateLoan, 
    addDocument,
    updateDocument, 
    getDocumentsByLoan, 
    populateTemplate,
    addContact,
    updateContact,
    deleteContact,
    getContactsByLoan,
    addFrequentContact,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    getNotesByLoan,
  } = useLoanStore();

  const {
    tasks,
    getTasksByDeal,
    toggleTaskStatus,
    addTask,
  } = useTaskStore();
  
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(loanPipelines[0]?.id || 'pipeline-2');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(loans[0] || null);
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'contacts' | 'emails' | 'ai'>('details');
  const [showNewLoanDialog, setShowNewLoanDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showSendToAnalystDialog, setShowSendToAnalystDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<LoanNote | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContact, setEditingContact] = useState<LoanContact | null>(null);
  const [selectedContactForEmail, setSelectedContactForEmail] = useState<LoanContact | null>(null);
  const [emailRecipientContact, setEmailRecipientContact] = useState<LoanContact | null>(null);

  // New Loan Form State
  const [newLoanForm, setNewLoanForm] = useState({
    borrowerName: '',
    borrowerEmail: '',
    borrowerPhone: '',
    propertyAddress: '',
    propertyCity: '',
    propertyState: '',
    propertyZip: '',
    loanAmount: '',
    propertyValue: '',
    loanType: 'Purchase' as Loan['loanType'],
    lender: '',
    targetCloseDate: '',
  });

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    category: 'Application' as DocumentCategory,
    notes: '',
  });

  // Email Form State
  const [emailForm, setEmailForm] = useState({
    templateId: '',
    to: '',
    subject: '',
    body: '',
  });

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Title Company' as LoanContact['role'],
    company: '',
    notes: '',
  });

  // Task Form State
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    contactId: '',
    type: 'follow-up' as 'follow-up' | 'document-review' | 'call' | 'email' | 'other',
  });

  // Edit Mode State
  const [isEditingLoan, setIsEditingLoan] = useState(false);
  const [editLoanForm, setEditLoanForm] = useState({
    borrowerName: '',
    borrowerEmail: '',
    borrowerPhone: '',
    borrowingEntity: '',
    borrowerPrimaryResidence: '',
    propertyAddress: '',
    propertyCity: '',
    propertyState: '',
    propertyZip: '',
    propertyType: '',
    loanAmount: '',
    propertyValue: '',
    loanType: 'Purchase' as Loan['loanType'],
    interestOnly: false,
    prepayPeriod: '',
    lender: '',
    targetCloseDate: '',
    interestRate: '',
    occupancyType: '',
    monthlyRent: '',
    marketRent: '',
    annualTaxes: '',
    annualInsurance: '',
    annualHOA: '',
  });

  const filteredLoans = loans
    .filter(loan => loan.pipelineId === selectedPipelineId)
    .filter(loan =>
      loan.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.lender.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Auto-calculate DSCR when relevant fields change in edit form
  useEffect(() => {
    if (!isEditingLoan || !selectedLoan) return;
    
    const loanAmt = parseFormattedNumber(editLoanForm.loanAmount);
    const rate = parseFloat(editLoanForm.interestRate);
    const rent = parseFormattedNumber(editLoanForm.monthlyRent);
    const taxes = parseFormattedNumber(editLoanForm.annualTaxes);
    const insurance = parseFormattedNumber(editLoanForm.annualInsurance);
    const hoa = parseFormattedNumber(editLoanForm.annualHOA);

    if (loanAmt && rate && rent) {
      const calculatedDSCR = calculateDSCR(
        loanAmt,
        rate,
        rent,
        taxes,
        insurance,
        hoa,
        editLoanForm.interestOnly
      );
      
      // Update the selected loan's DSCR in real-time for display
      if (calculatedDSCR !== selectedLoan.dscr) {
        updateLoan(selectedLoan.id, { dscr: calculatedDSCR });
      }
    }
  }, [
    editLoanForm.loanAmount,
    editLoanForm.interestRate,
    editLoanForm.monthlyRent,
    editLoanForm.annualTaxes,
    editLoanForm.annualInsurance,
    editLoanForm.annualHOA,
    editLoanForm.interestOnly, // DSCR recalculates when this toggles
    isEditingLoan,
    selectedLoan,
    updateLoan,
  ]);

  const handleCreateLoan = () => {
    if (!newLoanForm.borrowerName || !newLoanForm.loanAmount || !newLoanForm.propertyValue) {
      toast.error('Please fill in all required fields');
      return;
    }

    createLoan({
      borrowerName: newLoanForm.borrowerName,
      borrowerEmail: newLoanForm.borrowerEmail,
      borrowerPhone: newLoanForm.borrowerPhone,
      propertyAddress: newLoanForm.propertyAddress,
      propertyCity: newLoanForm.propertyCity,
      propertyState: newLoanForm.propertyState,
      propertyZip: newLoanForm.propertyZip,
      loanAmount: parseFloat(newLoanForm.loanAmount),
      propertyValue: parseFloat(newLoanForm.propertyValue),
      loanType: newLoanForm.loanType,
      lender: newLoanForm.lender,
      dealStage: 'New',
      targetCloseDate: newLoanForm.targetCloseDate,
      assignedAnalysts: [currentUser.id],
    }, selectedPipelineId);

    toast.success('Loan created successfully! (Synced with Deals)');
    setShowNewLoanDialog(false);
    setNewLoanForm({
      borrowerName: '',
      borrowerEmail: '',
      borrowerPhone: '',
      propertyAddress: '',
      propertyCity: '',
      propertyState: '',
      propertyZip: '',
      loanAmount: '',
      propertyValue: '',
      loanType: 'Purchase',
      lender: '',
      targetCloseDate: '',
    });
  };

  const handleUploadDocument = () => {
    if (!selectedLoan) return;

    addDocument({
      loanId: selectedLoan.id,
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 250000,
      category: uploadForm.category,
      status: 'Uploaded',
      uploadedBy: currentUser.id,
      notes: uploadForm.notes,
      isRequired: true,
    });

    toast.success('Document uploaded successfully!');
    setShowUploadDialog(false);
    setUploadForm({ category: 'Application', notes: '' });
  };

  const handleEditLoan = () => {
    if (!selectedLoan) return;
    
    setEditLoanForm({
      borrowerName: selectedLoan.borrowerName,
      borrowerEmail: selectedLoan.borrowerEmail,
      borrowerPhone: selectedLoan.borrowerPhone,
      borrowingEntity: selectedLoan.borrowingEntity || '',
      borrowerPrimaryResidence: selectedLoan.borrowerPrimaryResidence || '',
      propertyAddress: selectedLoan.propertyAddress,
      propertyCity: selectedLoan.propertyCity,
      propertyState: selectedLoan.propertyState,
      propertyZip: selectedLoan.propertyZip,
      propertyType: selectedLoan.propertyType || '',
      loanAmount: selectedLoan.loanAmount.toString(),
      propertyValue: selectedLoan.propertyValue.toString(),
      loanType: selectedLoan.loanType,
      interestOnly: selectedLoan.interestOnly || false,
      prepayPeriod: selectedLoan.prepayPeriod || '',
      lender: selectedLoan.lender,
      targetCloseDate: selectedLoan.targetCloseDate,
      interestRate: selectedLoan.interestRate?.toString() || '',
      occupancyType: selectedLoan.occupancyType || '',
      monthlyRent: selectedLoan.monthlyRent?.toString() || '',
      marketRent: selectedLoan.marketRent?.toString() || '',
      annualTaxes: selectedLoan.annualTaxes?.toString() || '',
      annualInsurance: selectedLoan.annualInsurance?.toString() || '',
      annualHOA: selectedLoan.annualHOA?.toString() || '',
    });
    setIsEditingLoan(true);
  };

  const handleSaveLoan = () => {
    if (!selectedLoan) return;

    updateLoan(selectedLoan.id, {
      borrowerName: editLoanForm.borrowerName,
      borrowerEmail: editLoanForm.borrowerEmail,
      borrowerPhone: editLoanForm.borrowerPhone,
      borrowingEntity: editLoanForm.borrowingEntity || undefined,
      borrowerPrimaryResidence: editLoanForm.borrowerPrimaryResidence || undefined,
      propertyAddress: editLoanForm.propertyAddress,
      propertyCity: editLoanForm.propertyCity,
      propertyState: editLoanForm.propertyState,
      propertyZip: editLoanForm.propertyZip,
      propertyType: editLoanForm.propertyType || undefined,
      loanAmount: parseFormattedNumber(editLoanForm.loanAmount),
      propertyValue: parseFormattedNumber(editLoanForm.propertyValue),
      loanType: editLoanForm.loanType,
      interestOnly: editLoanForm.interestOnly,
      prepayPeriod: (editLoanForm.prepayPeriod as any) || undefined,
      lender: editLoanForm.lender,
      targetCloseDate: editLoanForm.targetCloseDate,
      interestRate: editLoanForm.interestRate ? parseFloat(editLoanForm.interestRate) : undefined,
      occupancyType: editLoanForm.occupancyType || undefined,
      monthlyRent: editLoanForm.monthlyRent ? parseFormattedNumber(editLoanForm.monthlyRent) : undefined,
      marketRent: editLoanForm.marketRent ? parseFormattedNumber(editLoanForm.marketRent) : undefined,
      annualTaxes: editLoanForm.annualTaxes ? parseFormattedNumber(editLoanForm.annualTaxes) : undefined,
      annualInsurance: editLoanForm.annualInsurance ? parseFormattedNumber(editLoanForm.annualInsurance) : undefined,
      annualHOA: editLoanForm.annualHOA ? parseFormattedNumber(editLoanForm.annualHOA) : undefined,
    });

    toast.success('Loan updated successfully!');
    setIsEditingLoan(false);
  };

  const handleCancelEdit = () => {
    setIsEditingLoan(false);
  };

  const handleSendEmail = () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.body) {
      toast.error('Please fill in all email fields');
      return;
    }

    // Simulate sending email
    toast.success(`Email sent to ${emailForm.to}!`);
    setShowEmailDialog(false);
    setEmailForm({ templateId: '', to: '', subject: '', body: '' });
    setSelectedContactForEmail(null);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (!template || !selectedLoan) return;

    const populated = populateTemplate(template, selectedLoan);
    setEmailForm({
      ...emailForm,
      templateId,
      subject: populated.subject,
      body: populated.body,
    });
  };

  const handleAddOrUpdateContact = () => {
    if (!selectedLoan || !contactForm.name || !contactForm.email || !contactForm.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingContact) {
      updateContact(editingContact.id, {
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        role: contactForm.role,
        company: contactForm.company,
        notes: contactForm.notes,
      });
      toast.success('Contact updated successfully!');
    } else {
      addContact({
        loanId: selectedLoan.id,
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        role: contactForm.role,
        company: contactForm.company || undefined,
        notes: contactForm.notes || undefined,
      });
      toast.success('Contact added successfully!');
    }

    setShowContactDialog(false);
    setEditingContact(null);
    setContactForm({
      name: '',
      email: '',
      phone: '',
      role: 'Title Company',
      company: '',
      notes: '',
    });
  };

  const handleEditContact = (contact: LoanContact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      role: contact.role,
      company: contact.company || '',
      notes: contact.notes || '',
    });
    setShowContactDialog(true);
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContact(contactId);
      toast.success('Contact deleted successfully!');
    }
  };

  const handleSendEmailToContact = (contact: LoanContact) => {
    setSelectedContactForEmail(contact);
    setEmailForm({
      ...emailForm,
      to: contact.email,
    });
    setShowEmailDialog(true);
  };

  const loanContacts = selectedLoan ? getContactsByLoan(selectedLoan.id) : [];
  const loanDocuments = selectedLoan ? getDocumentsByLoan(selectedLoan.id) : [];
  const requiredDocs = selectedLoan ? LENDER_REQUIRED_DOCS[selectedLoan.lender] || [] : [];

  const getDealStageColor = (stage: Loan['dealStage']) => {
    const colors: Record<Loan['dealStage'], string> = {
      'New': 'bg-blue-500',
      'Documents': 'bg-amber-500',
      'Review': 'bg-purple-500',
      'Underwriting': 'bg-orange-500',
      'Approved': 'bg-green-500',
      'Closing': 'bg-cyan-500',
      'Funded': 'bg-emerald-500',
      'Cancelled': 'bg-red-500',
    };
    return colors[stage];
  };

  const getRoleIcon = (role: LoanContact['role']) => {
    const icons: Record<LoanContact['role'], any> = {
      'Borrower': User,
      'Analyst': Target,
      'Lender': Building,
      'Title Company': FileText,
      'Insurance Agent': AlertCircle,
      'Appraiser': Home,
      'Other': Users,
    };
    return icons[role];
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b bg-background">
          <Button 
            className="w-full mb-4" 
            onClick={() => setShowNewLoanDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Loan
          </Button>

          {/* Pipeline Selector */}
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground mb-1 block">Pipeline</Label>
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {loanPipelines.map(pipeline => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Synced with Deals module
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search loans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Loans List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredLoans.length === 0 ? (
              <div className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  {searchQuery ? 'No loans match your search' : 'No loans in this pipeline yet'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowNewLoanDialog(true)} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Loan
                  </Button>
                )}
              </div>
            ) : (
              filteredLoans.map((loan) => {
                const initials = loan.borrowerName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase();

                return (
                  <Card
                    key={loan.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedLoan?.id === loan.id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedLoan(loan)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{loan.borrowerName}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {loan.propertyAddress}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {loan.lender} · ${(loan.loanAmount / 1000).toFixed(0)}K
                            </p>
                          </div>
                          <Badge className={`mt-2 ${getDealStageColor(loan.dealStage)} text-white text-xs`}>
                            {loan.dealStage}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedLoan ? (
          <>
            {/* Loan Header */}
            <div className="border-b bg-background p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {selectedLoan.borrowerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2>{selectedLoan.borrowerName}</h2>
                    <p className="text-muted-foreground">
                      {selectedLoan.propertyAddress}, {selectedLoan.propertyCity}, {selectedLoan.propertyState} {selectedLoan.propertyZip}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span>{selectedLoan.lender}</span>
                      <span>•</span>
                      <span>{selectedLoan.loanType}</span>
                      <span>•</span>
                      <span>${selectedLoan.loanAmount.toLocaleString()}</span>
                      <span>•</span>
                      <Badge className={`${getDealStageColor(selectedLoan.dealStage)} text-white`}>
                        {selectedLoan.dealStage}
                      </Badge>
                      <span>•</span>
                      <span>LTV: {selectedLoan.ltv}%</span>
                      <span>•</span>
                      <span>Close: {selectedLoan.targetCloseDate}</span>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setShowSendToAnalystDialog(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Analyst
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b px-6 bg-background">
                <TabsList>
                  <TabsTrigger value="details">
                    <FileText className="h-4 w-4 mr-2" />
                    Loan Details
                  </TabsTrigger>
                  <TabsTrigger value="documents">
                    <Upload className="h-4 w-4 mr-2" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="contacts">
                    <Users className="h-4 w-4 mr-2" />
                    Contacts
                  </TabsTrigger>
                  <TabsTrigger value="ai">
                    <Bot className="h-4 w-4 mr-2" />
                    AI Assistant
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 h-full">
                {/* Loan Details Tab */}
                <TabsContent value="details" className="m-0 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={
                          selectedLoan.dealStage === 'Funded' ? 'default' :
                          selectedLoan.dealStage === 'Approved' ? 'default' :
                          selectedLoan.dealStage === 'Cancelled' ? 'destructive' :
                          'secondary'
                        }
                        className={`text-base px-4 py-2 ${
                          selectedLoan.dealStage === 'Funded' ? 'bg-green-600 hover:bg-green-700' :
                          selectedLoan.dealStage === 'Approved' ? 'bg-blue-600 hover:bg-blue-700' :
                          selectedLoan.dealStage === 'Closing' ? 'bg-purple-600 hover:bg-purple-700' :
                          selectedLoan.dealStage === 'Underwriting' ? 'bg-amber-600 hover:bg-amber-700' :
                          ''
                        }`}
                      >
                        {selectedLoan.dealStage}
                      </Badge>
                      <span className="text-sm text-muted-foreground">Current Stage</span>
                    </div>
                    {!isEditingLoan ? (
                      <Button onClick={handleEditLoan} variant="outline" size="sm">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Loan Details
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={handleCancelEdit} variant="outline" size="sm">
                          Cancel
                        </Button>
                        <Button onClick={handleSaveLoan} size="sm">
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Loan Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground text-sm">Loan Amount</Label>
                          {isEditingLoan ? (
                            <Input
                              type="number"
                              value={editLoanForm.loanAmount}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, loanAmount: e.target.value })}
                            />
                          ) : (
                            <p>${selectedLoan.loanAmount.toLocaleString()}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Property Value</Label>
                          {isEditingLoan ? (
                            <Input
                              type="number"
                              value={editLoanForm.propertyValue}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, propertyValue: e.target.value })}
                            />
                          ) : (
                            <p>${selectedLoan.propertyValue.toLocaleString()}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">LTV Ratio</Label>
                          <p>{selectedLoan.ltv}%</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Loan Type</Label>
                          {isEditingLoan ? (
                            <Select
                              value={editLoanForm.loanType}
                              onValueChange={(value: any) => setEditLoanForm({ ...editLoanForm, loanType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Purchase">Purchase</SelectItem>
                                <SelectItem value="Refinance">Refinance</SelectItem>
                                <SelectItem value="Cash Out">Cash Out</SelectItem>
                                <SelectItem value="HELOC">HELOC</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p>{selectedLoan.loanType}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Lender</Label>
                          {isEditingLoan ? (
                            <Select
                              value={editLoanForm.lender}
                              onValueChange={(value) => setEditLoanForm({ ...editLoanForm, lender: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Kiavi">Kiavi</SelectItem>
                                <SelectItem value="Visio">Visio</SelectItem>
                                <SelectItem value="ROC Capital">ROC Capital</SelectItem>
                                <SelectItem value="AHL">AHL (American Heritage Lending)</SelectItem>
                                <SelectItem value="Velocity">Velocity</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p>{selectedLoan.lender}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Target Close Date</Label>
                          {isEditingLoan ? (
                            <Input
                              type="date"
                              value={editLoanForm.targetCloseDate}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, targetCloseDate: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.targetCloseDate}</p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 pt-2">
                            {isEditingLoan ? (
                              <>
                                <Checkbox
                                  id="interestOnly"
                                  checked={editLoanForm.interestOnly}
                                  onCheckedChange={(checked) => {
                                    const newInterestOnly = checked as boolean;
                                    setEditLoanForm({ ...editLoanForm, interestOnly: newInterestOnly });
                                    
                                    // Calculate new DSCR immediately
                                    const loanAmt = parseFormattedNumber(editLoanForm.loanAmount);
                                    const rate = parseFloat(editLoanForm.interestRate);
                                    const rent = parseFormattedNumber(editLoanForm.monthlyRent);
                                    const taxes = parseFormattedNumber(editLoanForm.annualTaxes);
                                    const insurance = parseFormattedNumber(editLoanForm.annualInsurance);
                                    const hoa = parseFormattedNumber(editLoanForm.annualHOA);
                                    
                                    if (loanAmt && rate && rent) {
                                      const newDSCR = calculateDSCR(loanAmt, rate, rent, taxes, insurance, hoa, newInterestOnly);
                                      const oldDSCR = calculateDSCR(loanAmt, rate, rent, taxes, insurance, hoa, !newInterestOnly);
                                      
                                      // Update immediately
                                      if (selectedLoan) {
                                        updateLoan(selectedLoan.id, { dscr: newDSCR, interestOnly: newInterestOnly });
                                      }
                                      
                                      // Show impact in toast
                                      if (newInterestOnly) {
                                        toast.success(`Interest Only enabled - DSCR improved from ${oldDSCR.toFixed(2)} to ${newDSCR.toFixed(2)}`);
                                      } else {
                                        toast.success(`Standard amortization - DSCR changed from ${oldDSCR.toFixed(2)} to ${newDSCR.toFixed(2)}`);
                                      }
                                    }
                                  }}
                                />
                                <Label htmlFor="interestOnly" className="cursor-pointer font-medium">
                                  Interest Only Loan
                                </Label>
                              </>
                            ) : (
                              <>
                                <Checkbox
                                  id="interestOnlyDisplay"
                                  checked={selectedLoan.interestOnly || false}
                                  disabled
                                />
                                <Label htmlFor="interestOnlyDisplay" className="text-muted-foreground">
                                  Interest Only Loan
                                </Label>
                              </>
                            )}
                          </div>
                          {(() => {
                            const loanAmt = isEditingLoan ? parseFormattedNumber(editLoanForm.loanAmount) : selectedLoan.loanAmount;
                            const rate = isEditingLoan ? parseFloat(editLoanForm.interestRate) : selectedLoan.interestRate;
                            const isIO = isEditingLoan ? editLoanForm.interestOnly : selectedLoan.interestOnly;
                            
                            if (loanAmt && rate) {
                              const monthlyRate = rate / 100 / 12;
                              const numberOfPayments = 30 * 12;
                              const regularPayment = loanAmt * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
                              const ioPayment = (loanAmt * (rate / 100)) / 12;
                              const savings = regularPayment - ioPayment;
                              
                              if (isIO) {
                                return (
                                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                                    <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                                      Monthly Payment: ${ioPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-500">
                                      Saves ${savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo vs. P&I (Improves DSCR)
                                    </p>
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Prepay Period</Label>
                          {isEditingLoan ? (
                            <Select
                              value={editLoanForm.prepayPeriod}
                              onValueChange={(value) => setEditLoanForm({ ...editLoanForm, prepayPeriod: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select period..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="None">None</SelectItem>
                                <SelectItem value="1 Year">1 Year</SelectItem>
                                <SelectItem value="2 Year">2 Year</SelectItem>
                                <SelectItem value="3 Year">3 Year</SelectItem>
                                <SelectItem value="5 Year">5 Year</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p>{selectedLoan.prepayPeriod || '-'}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Interest Rate</Label>
                          {isEditingLoan ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editLoanForm.interestRate}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, interestRate: e.target.value })}
                              placeholder="7.5"
                            />
                          ) : (
                            <p>{selectedLoan.interestRate ? `${selectedLoan.interestRate}%` : '-'}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Borrower Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground text-sm">Borrowing Entity</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.borrowingEntity}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, borrowingEntity: e.target.value })}
                              placeholder="e.g., Bradstreet 1800 LLC"
                            />
                          ) : (
                            <p>{selectedLoan.borrowingEntity || '-'}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Borrower Name</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.borrowerName}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, borrowerName: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.borrowerName}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Primary Residence</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.borrowerPrimaryResidence}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, borrowerPrimaryResidence: e.target.value })}
                              placeholder="Borrower's home address"
                            />
                          ) : (
                            <p>{selectedLoan.borrowerPrimaryResidence || '-'}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Email</Label>
                          {isEditingLoan ? (
                            <Input
                              type="email"
                              value={editLoanForm.borrowerEmail}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, borrowerEmail: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.borrowerEmail}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Phone</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.borrowerPhone}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, borrowerPhone: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.borrowerPhone}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5" />
                          Property Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-muted-foreground text-sm">Address</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.propertyAddress}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, propertyAddress: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.propertyAddress}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">City</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.propertyCity}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, propertyCity: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.propertyCity}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">State</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.propertyState}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, propertyState: e.target.value })}
                              placeholder="CA"
                            />
                          ) : (
                            <p>{selectedLoan.propertyState}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">ZIP Code</Label>
                          {isEditingLoan ? (
                            <Input
                              value={editLoanForm.propertyZip}
                              onChange={(e) => setEditLoanForm({ ...editLoanForm, propertyZip: e.target.value })}
                            />
                          ) : (
                            <p>{selectedLoan.propertyZip}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Property Type</Label>
                          {isEditingLoan ? (
                            <Select
                              value={editLoanForm.propertyType}
                              onValueChange={(value) => setEditLoanForm({ ...editLoanForm, propertyType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Single Family">Single Family</SelectItem>
                                <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                                <SelectItem value="Condo">Condo</SelectItem>
                                <SelectItem value="Townhouse">Townhouse</SelectItem>
                                <SelectItem value="Commercial">Commercial</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p>{selectedLoan.propertyType || '-'}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* DSCR Calculator Section */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Percent className="h-5 w-5" />
                        DSCR Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        {/* Left Column - Income & Expenses */}
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm">Occupancy Status</Label>
                            {isEditingLoan ? (
                              <Select
                                value={editLoanForm.occupancyType}
                                onValueChange={(value) => setEditLoanForm({ ...editLoanForm, occupancyType: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Leased">Leased</SelectItem>
                                  <SelectItem value="Short Term Rental">Short Term Rental</SelectItem>
                                  <SelectItem value="Vacant">Vacant</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="mt-1">
                                <Badge variant={
                                  selectedLoan.occupancyType === 'Leased' ? 'default' :
                                  selectedLoan.occupancyType === 'Short Term Rental' ? 'secondary' :
                                  'outline'
                                }>
                                  {selectedLoan.occupancyType || 'Not Set'}
                                </Badge>
                              </div>
                            )}
                          </div>

                          <div>
                            <Label className="text-muted-foreground text-sm">
                              {editLoanForm.occupancyType === 'Short Term Rental' || selectedLoan.occupancyType === 'Short Term Rental' ? 'Monthly STR Income' : 'Monthly Rent'}
                            </Label>
                            {isEditingLoan ? (
                              <Input
                                type="number"
                                value={editLoanForm.monthlyRent}
                                onChange={(e) => setEditLoanForm({ ...editLoanForm, monthlyRent: e.target.value })}
                                placeholder="4500"
                              />
                            ) : (
                              <p className="text-xl">${selectedLoan.monthlyRent?.toLocaleString() || 0}</p>
                            )}
                          </div>

                          <div>
                            <Label className="text-muted-foreground text-sm">Market Rent</Label>
                            {isEditingLoan ? (
                              <Input
                                type="number"
                                value={editLoanForm.marketRent}
                                onChange={(e) => setEditLoanForm({ ...editLoanForm, marketRent: e.target.value })}
                                placeholder="4800"
                              />
                            ) : (
                              <>
                                <p className="text-xl">${selectedLoan.marketRent?.toLocaleString() || 0}</p>
                                {selectedLoan.monthlyRent && selectedLoan.marketRent && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {selectedLoan.monthlyRent > selectedLoan.marketRent ? (
                                      <span className="text-green-600">Above market by ${(selectedLoan.monthlyRent - selectedLoan.marketRent).toLocaleString()}</span>
                                    ) : selectedLoan.monthlyRent < selectedLoan.marketRent ? (
                                      <span className="text-amber-600">Below market by ${(selectedLoan.marketRent - selectedLoan.monthlyRent).toLocaleString()}</span>
                                    ) : (
                                      <span>At market rate</span>
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          <Separator />

                          <div>
                            <Label className="text-muted-foreground text-sm">Annual Property Taxes</Label>
                            {isEditingLoan ? (
                              <Input
                                type="number"
                                value={editLoanForm.annualTaxes}
                                onChange={(e) => setEditLoanForm({ ...editLoanForm, annualTaxes: e.target.value })}
                                placeholder="12000"
                              />
                            ) : (
                              <>
                                <p>${selectedLoan.annualTaxes?.toLocaleString() || 0}</p>
                                {selectedLoan.annualTaxes !== undefined && (
                                  <p className="text-xs text-muted-foreground">${(selectedLoan.annualTaxes / 12).toFixed(0)}/mo</p>
                                )}
                              </>
                            )}
                          </div>

                          <div>
                            <Label className="text-muted-foreground text-sm">Annual Insurance</Label>
                            {isEditingLoan ? (
                              <Input
                                type="number"
                                value={editLoanForm.annualInsurance}
                                onChange={(e) => setEditLoanForm({ ...editLoanForm, annualInsurance: e.target.value })}
                                placeholder="2400"
                              />
                            ) : (
                              <>
                                <p>${selectedLoan.annualInsurance?.toLocaleString() || 0}</p>
                                {selectedLoan.annualInsurance !== undefined && (
                                  <p className="text-xs text-muted-foreground">${(selectedLoan.annualInsurance / 12).toFixed(0)}/mo</p>
                                )}
                              </>
                            )}
                          </div>

                          <div>
                            <Label className="text-muted-foreground text-sm">Annual HOA Fees</Label>
                            {isEditingLoan ? (
                              <Input
                                type="number"
                                value={editLoanForm.annualHOA}
                                onChange={(e) => setEditLoanForm({ ...editLoanForm, annualHOA: e.target.value })}
                                placeholder="0"
                              />
                            ) : (
                              <>
                                <p>${selectedLoan.annualHOA?.toLocaleString() || 0}</p>
                                {selectedLoan.annualHOA !== undefined && selectedLoan.annualHOA > 0 && (
                                  <p className="text-xs text-muted-foreground">${(selectedLoan.annualHOA / 12).toFixed(0)}/mo</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                          {/* Right Column - DSCR Calculation */}
                          <div className="space-y-4">
                            {selectedLoan.dscr !== undefined && (
                              <>
                                <div className="p-4 bg-primary/10 rounded-lg text-center">
                                  <Label className="text-sm text-muted-foreground">DSCR Ratio</Label>
                                  <p className={`text-4xl mt-2 ${
                                    selectedLoan.dscr >= 1.25 ? 'text-green-600' :
                                    selectedLoan.dscr >= 1.0 ? 'text-amber-600' :
                                    'text-red-600'
                                  }`}>
                                    {selectedLoan.dscr.toFixed(2)}
                                  </p>
                                  <p className="text-sm mt-2">
                                    {selectedLoan.dscr >= 1.25 ? (
                                      <span className="text-green-600">✓ Strong</span>
                                    ) : selectedLoan.dscr >= 1.0 ? (
                                      <span className="text-amber-600">⚠ Acceptable</span>
                                    ) : (
                                      <span className="text-red-600">✗ Below Threshold</span>
                                    )}
                                  </p>
                                </div>

                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Monthly Income:</span>
                                    <span>${selectedLoan.monthlyRent?.toLocaleString() || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Annual Income:</span>
                                    <span>${((selectedLoan.monthlyRent || 0) * 12).toLocaleString()}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Annual Expenses:</span>
                                    <span>${((selectedLoan.annualTaxes || 0) + (selectedLoan.annualInsurance || 0) + (selectedLoan.annualHOA || 0)).toLocaleString()}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Net Operating Income:</span>
                                    <span className="font-medium">${(((selectedLoan.monthlyRent || 0) * 12) - ((selectedLoan.annualTaxes || 0) + (selectedLoan.annualInsurance || 0) + (selectedLoan.annualHOA || 0))).toLocaleString()}</span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                  {/* Notes Section */}
                  <Card className="mt-6">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Notes
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add important information and updates for this loan
                          </p>
                        </div>
                        <Button onClick={() => {
                          setEditingNote(null);
                          setNoteContent('');
                          setShowNoteDialog(true);
                        }} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Note
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const loanNotes = selectedLoan ? getNotesByLoan(selectedLoan.id) : [];
                        const pinnedNotes = loanNotes.filter(n => n.isPinned);
                        const unpinnedNotes = loanNotes.filter(n => !n.isPinned);
                        
                        if (loanNotes.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                              <p className="text-sm text-muted-foreground mb-4">
                                No notes yet. Add important information about this loan.
                              </p>
                              <Button onClick={() => setShowNoteDialog(true)} size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Note
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {/* Pinned Notes */}
                            {pinnedNotes.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                  <Pin className="h-4 w-4" />
                                  Pinned ({pinnedNotes.length})
                                </h4>
                                {pinnedNotes.map((note) => (
                                  <Collapsible key={note.id} defaultOpen={true}>
                                    <Card className="border-l-4 border-l-primary bg-primary/5">
                                      <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                                              <ChevronDown className="h-4 w-4" />
                                            </Button>
                                          </CollapsibleTrigger>
                                          
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <Badge variant="default" className="text-xs bg-primary">
                                                    Pinned
                                                  </Badge>
                                                  <span className="text-xs text-muted-foreground">
                                                    {note.createdByName} • {new Date(note.createdAt).toLocaleDateString()}
                                                  </span>
                                                </div>
                                                <CollapsibleContent>
                                                  <p className="text-sm mt-2">{note.content}</p>
                                                </CollapsibleContent>
                                              </div>
                                              
                                              <div className="flex gap-1 shrink-0">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-7 w-7 p-0 hover:bg-blue-500/10 hover:text-blue-600"
                                                  onClick={() => {
                                                    setEditingNote(note);
                                                    setNoteContent(note.content);
                                                    setShowNoteDialog(true);
                                                  }}
                                                  title="Edit note"
                                                >
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-7 w-7 p-0 hover:bg-amber-500/10 hover:text-amber-600"
                                                  onClick={() => togglePinNote(note.id)}
                                                  title="Unpin note"
                                                >
                                                  <Pin className="h-3.5 w-3.5 fill-current" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-7 w-7 p-0 hover:bg-red-500/10 hover:text-red-600"
                                                  onClick={() => {
                                                    deleteNote(note.id);
                                                    toast.success('Note deleted');
                                                  }}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </Collapsible>
                                ))}
                              </div>
                            )}

                            {/* Regular Notes */}
                            {unpinnedNotes.length > 0 && (
                              <div className="space-y-2">
                                {pinnedNotes.length > 0 && (
                                  <h4 className="text-sm font-medium text-muted-foreground mt-4">
                                    Recent ({unpinnedNotes.length})
                                  </h4>
                                )}
                                {unpinnedNotes.map((note) => (
                                  <Collapsible key={note.id}>
                                    <Card className="hover:shadow-sm transition-shadow">
                                      <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                                              <ChevronRight className="h-4 w-4" />
                                            </Button>
                                          </CollapsibleTrigger>
                                          
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="text-sm font-medium">{note.createdByName}</span>
                                                  <span className="text-xs text-muted-foreground">
                                                    {new Date(note.createdAt).toLocaleDateString()}
                                                  </span>
                                                </div>
                                                <CollapsibleContent>
                                                  <p className="text-sm text-muted-foreground mt-2">{note.content}</p>
                                                </CollapsibleContent>
                                              </div>
                                              
                                              <div className="flex gap-1 shrink-0">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-7 w-7 p-0 hover:bg-blue-500/10 hover:text-blue-600"
                                                  onClick={() => {
                                                    setEditingNote(note);
                                                    setNoteContent(note.content);
                                                    setShowNoteDialog(true);
                                                  }}
                                                  title="Edit note"
                                                >
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-7 w-7 p-0 hover:bg-amber-500/10 hover:text-amber-600"
                                                  onClick={() => {
                                                    togglePinNote(note.id);
                                                    toast.success('Note pinned to top');
                                                  }}
                                                  title="Pin note"
                                                >
                                                  <Pin className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-7 w-7 p-0 hover:bg-red-500/10 hover:text-red-600"
                                                  onClick={() => {
                                                    deleteNote(note.id);
                                                    toast.success('Note deleted');
                                                  }}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </Collapsible>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Tasks Section */}
                  <Card className="mt-6">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" />
                            Tasks & Follow-ups
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Track action items tied to loan contacts
                          </p>
                        </div>
                        <Button onClick={() => setShowTaskDialog(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const loanTasks = selectedLoan ? getTasksByDeal(selectedLoan.dealId) : [];
                        
                        console.log('Selected Loan dealId:', selectedLoan?.dealId);
                        console.log('Tasks for this loan:', loanTasks);
                        console.log('All tasks:', tasks);
                        
                        if (loanTasks.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                              <p className="text-sm text-muted-foreground mb-4">
                                No tasks yet. Create tasks to track follow-ups with title agents, insurance agents, and other contacts.
                              </p>
                              <Button onClick={() => setShowTaskDialog(true)} size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Task
                              </Button>
                            </div>
                          );
                        }

                        // Separate pending and completed tasks
                        const pendingTasks = loanTasks.filter(t => t.status === 'pending');
                        const completedTasks = loanTasks.filter(t => t.status === 'completed');

                        return (
                          <div className="space-y-4">
                            {/* Pending Tasks */}
                            {pendingTasks.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                  Active Tasks ({pendingTasks.length})
                                </h4>
                                <div className="space-y-3">
                                  {pendingTasks.map((task) => {
                                    const isOverdue = task.dueDate < new Date().toISOString().split('T')[0];
                                    const priorityColors = {
                                      low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                                      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
                                      high: 'bg-red-500/10 text-red-600 border-red-500/20',
                                    };

                                    // Find associated contact
                                    const taskContact = loanContacts.find(c => c.id === task.contactId);
                                    const ContactIcon = taskContact ? getRoleIcon(taskContact.role) : User;

                                    return (
                                      <Card 
                                        key={task.id} 
                                        className={`hover:shadow-md transition-all ${isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-primary'}`}
                                      >
                                        <CardContent className="p-4">
                                          <div className="flex items-start gap-3">
                                            <button
                                              onClick={() => toggleTaskStatus(task.id)}
                                              className="mt-0.5 hover:scale-110 transition-transform"
                                            >
                                              <div className="h-5 w-5 border-2 border-primary rounded-full hover:bg-primary/10 transition-colors" />
                                            </button>

                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex-1">
                                                  <h4 className="font-medium">{task.title}</h4>
                                                  
                                                  {/* Contact Info with Icons */}
                                                  {taskContact && (
                                                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-accent/50">
                                                      <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                          {taskContact.name.split(' ').map(n => n[0]).join('')}
                                                        </AvatarFallback>
                                                      </Avatar>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{taskContact.name}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                          <ContactIcon className="h-3 w-3" />
                                                          {taskContact.role}
                                                        </p>
                                                      </div>
                                                      {/* Quick Contact Buttons */}
                                                      <div className="flex gap-1 shrink-0">
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-7 w-7 p-0 hover:bg-green-500/10 hover:text-green-600"
                                                          onClick={() => {
                                                            toast.success(`Calling ${taskContact.name} at ${taskContact.phone}...`);
                                                          }}
                                                        >
                                                          <Phone className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-7 w-7 p-0 hover:bg-blue-500/10 hover:text-blue-600"
                                                          onClick={() => handleSendEmailToContact(taskContact)}
                                                        >
                                                          <Mail className="h-3.5 w-3.5" />
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                                
                                                <Badge 
                                                  variant="outline" 
                                                  className={priorityColors[task.priority || 'medium']}
                                                >
                                                  {task.priority || 'medium'}
                                                </Badge>
                                              </div>

                                              {task.description && (
                                                <p className="text-sm text-muted-foreground mb-3 mt-2">{task.description}</p>
                                              )}

                                              <div className="flex items-center gap-3 text-sm">
                                                <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                                  <Calendar className="h-3.5 w-3.5" />
                                                  <span>
                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                    {isOverdue && ' (Overdue)'}
                                                  </span>
                                                </div>
                                                
                                                {task.type && (
                                                  <Badge variant="secondary" className="text-xs">
                                                    {task.type}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Completed Tasks */}
                            {completedTasks.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                  Completed ({completedTasks.length})
                                </h4>
                                <div className="space-y-2">
                                  {completedTasks.map((task) => {
                                    const taskContact = loanContacts.find(c => c.id === task.contactId);
                                    return (
                                      <Card key={task.id} className="opacity-60 hover:opacity-80 transition-opacity">
                                        <CardContent className="p-3">
                                          <div className="flex items-center gap-3">
                                            <button onClick={() => toggleTaskStatus(task.id)}>
                                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm line-through truncate">{task.title}</p>
                                              {taskContact && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                  {taskContact.name} • {taskContact.role}
                                                </p>
                                              )}
                                            </div>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                              {new Date(task.dueDate).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="m-0 p-6">
                  <LoanDocumentsTab
                    selectedLoan={selectedLoan}
                    loanDocuments={loanDocuments}
                    onAddDocument={addDocument}
                    onUpdateDocument={updateDocument}
                  />
                </TabsContent>

                {/* Contacts Tab - Quick Action Panel */}
                <TabsContent value="contacts" className="m-0 p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="mb-1">Quick Contact</h3>
                      <p className="text-sm text-muted-foreground">Instantly call or email key contacts for this loan</p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setEditingContact(null);
                        setContactForm({
                          name: '',
                          email: '',
                          phone: '',
                          role: 'Title Company',
                          company: '',
                          notes: '',
                        });
                        setShowContactDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </div>

                  {/* Contact Role Cards with Quick Actions */}
                  <div className="space-y-2">
                    {[
                      { role: 'Analyst', icon: User, color: 'indigo' },
                      { role: 'Title Company', icon: Building, color: 'blue' },
                      { role: 'Insurance Agent', icon: Building, color: 'green' },
                      { role: 'Appraiser', icon: Home, color: 'purple' },
                      { role: '4 Point and Wind Mitigation Inspector', icon: Search, color: 'orange' },
                    ].map((roleInfo) => {
                      const contact = loanContacts.find(c => c.role === roleInfo.role);
                      const RoleIcon = roleInfo.icon;
                      const colorClasses = {
                        indigo: 'border-l-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10',
                        blue: 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10',
                        green: 'border-l-green-500 bg-green-50/30 dark:bg-green-950/10',
                        purple: 'border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/10',
                        orange: 'border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10',
                      };

                      return (
                        <Card 
                          key={roleInfo.role} 
                          className={`border-l-4 transition-all hover:shadow-md ${colorClasses[roleInfo.color as keyof typeof colorClasses]}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              {/* Role Icon */}
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-${roleInfo.color}-100 dark:bg-${roleInfo.color}-900/30 shrink-0`}>
                                <RoleIcon className={`h-5 w-5 text-${roleInfo.color}-600 dark:text-${roleInfo.color}-400`} />
                              </div>

                              {/* Contact Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold mb-0.5">{roleInfo.role}</h4>
                                {contact ? (
                                  <>
                                    <div className="flex items-center gap-2 group">
                                      <p className="text-sm truncate">{contact.name}</p>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-600 shrink-0"
                                        onClick={() => handleDeleteContact(contact.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    {contact.notes && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">
                                        {contact.notes}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Not assigned</p>
                                )}
                              </div>

                              {/* Quick Action Buttons */}
                              <div className="flex gap-1.5 shrink-0">
                                {contact ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 gap-1.5 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30"
                                      onClick={() => {
                                        toast.success(`Calling ${contact.name} at ${contact.phone}...`);
                                      }}
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                      <span className="text-xs">Call</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 gap-1.5 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30"
                                      onClick={() => handleSendEmailToContact(contact)}
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                      <span className="text-xs">Email</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleEditContact(contact)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3"
                                    onClick={() => {
                                      setEditingContact(null);
                                      setContactForm({
                                        name: '',
                                        email: '',
                                        phone: '',
                                        role: roleInfo.role,
                                        company: '',
                                        notes: '',
                                      });
                                      setShowContactDialog(true);
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                    <span className="text-xs">Assign</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Additional Contacts Section */}
                  {loanContacts.filter(c => !['Title Company', 'Insurance Agent', 'Appraiser', 'Inspector', 'Attorney', 'Escrow Officer'].includes(c.role)).length > 0 && (
                    <div className="mt-6">
                      <h4 className="mb-3 text-sm font-medium text-muted-foreground">Other Contacts</h4>
                      <div className="space-y-2">
                        {loanContacts
                          .filter(c => !['Title Company', 'Insurance Agent', 'Appraiser', 'Inspector', 'Attorney', 'Escrow Officer'].includes(c.role))
                          .map((contact) => {
                            const RoleIcon = getRoleIcon(contact.role);
                            return (
                              <Card key={contact.id} className="hover:shadow-md transition-all">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                        {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{contact.name}</p>
                                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <RoleIcon className="h-3 w-3" />
                                        {contact.role}
                                      </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600"
                                        onClick={() => {
                                          toast.success(`Calling ${contact.name} at ${contact.phone}...`);
                                        }}
                                      >
                                        <Phone className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 hover:bg-blue-500/10 hover:text-blue-600"
                                        onClick={() => handleSendEmailToContact(contact)}
                                      >
                                        <Mail className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleEditContact(contact)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600"
                                        onClick={() => handleDeleteContact(contact.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* AI Assistant Tab */}
                <TabsContent value="ai" className="m-0 p-6">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6 text-center">
                        <Bot className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h4 className="mb-2">Generate Tasks</h4>
                        <p className="text-sm text-muted-foreground">Auto-create task list from loan requirements</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6 text-center">
                        <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h4 className="mb-2">Analyze Documents</h4>
                        <p className="text-sm text-muted-foreground">Extract data and summarize uploaded files</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h4 className="mb-2">Detect Missing Docs</h4>
                        <p className="text-sm text-muted-foreground">Identify incomplete documentation</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6 text-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h4 className="mb-2">Ask AI</h4>
                        <p className="text-sm text-muted-foreground">Get answers about the loan process</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>AI Loan Assistant</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/30 p-4 rounded-lg mb-4">
                        <div className="flex items-start gap-3 mb-4">
                          <Bot className="h-6 w-6 text-primary flex-shrink-0" />
                          <div>
                            <p className="mb-2">Hi! I'm your AI loan assistant. I can help you:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              <li>Generate task lists from loan requirements</li>
                              <li>Analyze uploaded documents</li>
                              <li>Detect missing documents</li>
                              <li>Answer questions about the loan process</li>
                            </ul>
                            <p className="mt-4">What can I help you with?</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Input placeholder="Ask a question..." />
                        <Button>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3>No Loan Selected</h3>
              <p className="text-muted-foreground mb-6">Select a loan from the sidebar or create a new one</p>
              <Button onClick={() => setShowNewLoanDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Loan
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Utility Pane */}
      {selectedLoan && (
        <div className="w-80 border-l bg-muted/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Active Tasks */}
              {(() => {
                const loanTasks = selectedLoan ? getTasksByDeal(selectedLoan.dealId) : [];
                const pendingTasks = loanTasks.filter(t => t.status === 'pending');
                
                if (pendingTasks.length > 0) {
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <CheckCircle2 className="h-4 w-4" />
                          Active Tasks ({pendingTasks.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {pendingTasks.slice(0, 4).map((task) => {
                          const isOverdue = task.dueDate < new Date().toISOString().split('T')[0];
                          const taskContact = loanContacts.find(c => c.id === task.contactId);
                          
                          return (
                            <div 
                              key={task.id} 
                              className={`p-2.5 rounded-md border ${isOverdue ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-accent/30'} hover:bg-accent/50 transition-colors cursor-pointer`}
                              onClick={() => setActiveTab('details')}
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskStatus(task.id);
                                  }}
                                  className="mt-0.5"
                                >
                                  <div className="h-4 w-4 border-2 border-primary rounded-full hover:bg-primary/10 transition-colors" />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{task.title}</p>
                                  {taskContact && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {taskContact.name} • {taskContact.role}
                                    </p>
                                  )}
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                    {new Date(task.dueDate).toLocaleDateString()}
                                    {isOverdue && ' (Overdue)'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {pendingTasks.length > 4 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs mt-2"
                            onClick={() => setActiveTab('details')}
                          >
                            View all {pendingTasks.length} tasks →
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                }
                return null;
              })()}

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setShowTaskDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setShowContactDialog(true)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        size="sm"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select Contact</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {loanContacts.length > 0 ? (
                        loanContacts.map((contact) => {
                          const Icon = getRoleIcon(contact.role);
                          return (
                            <DropdownMenuItem
                              key={contact.id}
                              onClick={() => {
                                setEmailRecipientContact(contact);
                                handleSendEmailToContact(contact);
                              }}
                            >
                              <Icon className="h-4 w-4 mr-2" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{contact.name}</p>
                                <p className="text-xs text-muted-foreground">{contact.role}</p>
                              </div>
                            </DropdownMenuItem>
                          );
                        })
                      ) : (
                        <DropdownMenuItem disabled>
                          No contacts available
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowEmailDialog(true)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Compose New Email
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>

              {/* Key Contacts Quick Access */}
              {loanContacts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Key Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {loanContacts.slice(0, 3).map((contact) => {
                      const Icon = getRoleIcon(contact.role);
                      return (
                        <div key={contact.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{contact.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toast.success(`Calling ${contact.name}...`)}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleSendEmailToContact(contact)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {loanContacts.length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setActiveTab('contacts')}
                      >
                        View all {loanContacts.length} contacts →
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {loanDocuments.slice(0, 2).map((doc, idx) => (
                      <div key={doc.id} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-3 w-3 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">Uploaded</p>
                        </div>
                      </div>
                    ))}
                    {loanDocuments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No recent activity
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* New Loan Dialog */}
      <Dialog open={showNewLoanDialog} onOpenChange={setShowNewLoanDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Loan</DialogTitle>
            <DialogDescription>Enter the loan details below</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Borrower Name *</Label>
              <Input
                value={newLoanForm.borrowerName}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, borrowerName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Borrower Email</Label>
              <Input
                type="email"
                value={newLoanForm.borrowerEmail}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, borrowerEmail: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Borrower Phone</Label>
              <Input
                value={newLoanForm.borrowerPhone}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, borrowerPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Property Address *</Label>
              <Input
                value={newLoanForm.propertyAddress}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, propertyAddress: e.target.value })}
                placeholder="123 Main Street"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={newLoanForm.propertyCity}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, propertyCity: e.target.value })}
                placeholder="Los Angeles"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={newLoanForm.propertyState}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, propertyState: e.target.value })}
                placeholder="CA"
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                value={newLoanForm.propertyZip}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, propertyZip: e.target.value })}
                placeholder="90001"
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Amount *</Label>
              <Input
                type="number"
                value={newLoanForm.loanAmount}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, loanAmount: e.target.value })}
                placeholder="450000"
              />
            </div>
            <div className="space-y-2">
              <Label>Property Value *</Label>
              <Input
                type="number"
                value={newLoanForm.propertyValue}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, propertyValue: e.target.value })}
                placeholder="600000"
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Type</Label>
              <Select
                value={newLoanForm.loanType}
                onValueChange={(value: any) => setNewLoanForm({ ...newLoanForm, loanType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="Refinance">Refinance</SelectItem>
                  <SelectItem value="Cash Out">Cash Out</SelectItem>
                  <SelectItem value="HELOC">HELOC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lender</Label>
              <Select
                value={newLoanForm.lender}
                onValueChange={(value) => setNewLoanForm({ ...newLoanForm, lender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select DSCR lender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kiavi">Kiavi</SelectItem>
                  <SelectItem value="Visio">Visio</SelectItem>
                  <SelectItem value="ROC Capital">ROC Capital</SelectItem>
                  <SelectItem value="AHL">AHL (American Heritage Lending)</SelectItem>
                  <SelectItem value="Velocity">Velocity</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Each lender has specific document requirements</p>
            </div>
            <div className="space-y-2">
              <Label>Target Close Date</Label>
              <Input
                type="date"
                value={newLoanForm.targetCloseDate}
                onChange={(e) => setNewLoanForm({ ...newLoanForm, targetCloseDate: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewLoanDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLoan}>Create Loan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Select a document to upload</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={uploadForm.category}
                onValueChange={(value: any) => setUploadForm({ ...uploadForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Application">Application</SelectItem>
                  <SelectItem value="Income Verification">Income Verification</SelectItem>
                  <SelectItem value="Tax Returns">Tax Returns</SelectItem>
                  <SelectItem value="Bank Statements">Bank Statements</SelectItem>
                  <SelectItem value="Credit Report">Credit Report</SelectItem>
                  <SelectItem value="Appraisal">Appraisal</SelectItem>
                  <SelectItem value="Title Report">Title Report</SelectItem>
                  <SelectItem value="Insurance">Insurance</SelectItem>
                  <SelectItem value="Purchase Agreement">Purchase Agreement</SelectItem>
                  <SelectItem value="Payoff Statement">Payoff Statement</SelectItem>
                  <SelectItem value="HOA Documents">HOA Documents</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                placeholder="Add notes about this document..."
              />
            </div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drag file here or click to browse</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadDocument}>Upload</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Update contact information' : 'Add a new contact for this loan'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingContact && (
              <div className="space-y-2">
                <Label>Select Frequent Contact (Optional)</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const contact = frequentContacts[parseInt(value)];
                    if (contact) {
                      setContactForm({
                        name: contact.name,
                        email: contact.email,
                        phone: contact.phone,
                        role: contact.role,
                        company: contact.company || '',
                        notes: contact.notes || '',
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Or select from frequently used contacts" />
                  </SelectTrigger>
                  <SelectContent>
                    {frequentContacts.map((contact, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {contact.name} - {contact.company} ({contact.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={contactForm.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setContactForm({ ...contactForm, phone: formatted });
                }}
                placeholder="(917) 963-0181"
                maxLength={14}
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={contactForm.role}
                onValueChange={(value: any) => setContactForm({ ...contactForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Borrower">Borrower</SelectItem>
                  <SelectItem value="Analyst">Analyst</SelectItem>
                  <SelectItem value="Lender">Lender</SelectItem>
                  <SelectItem value="Title Company">Title Company</SelectItem>
                  <SelectItem value="Insurance Agent">Insurance Agent</SelectItem>
                  <SelectItem value="Appraiser">Appraiser</SelectItem>
                  <SelectItem value="4 Point and Wind Mitigation Inspector">4 Point and Wind Mitigation Inspector</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Company (Optional)</Label>
              <Input
                value={contactForm.company}
                onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                placeholder="ABC Title Company"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                placeholder="Additional notes about this contact..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowContactDialog(false);
                setEditingContact(null);
                setContactForm({
                  name: '',
                  email: '',
                  phone: '',
                  role: 'Title Company',
                  company: '',
                  notes: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddOrUpdateContact}>
              {editingContact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
            <DialogDescription>
              {selectedContactForEmail 
                ? `Sending to ${selectedContactForEmail.name}`
                : 'Send an email using a template or compose manually'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={emailForm.templateId}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template or compose manually" />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                value={emailForm.to}
                onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                placeholder="Email body..."
                rows={10}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail}>
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a task and assign it to a contact for follow-up
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Follow up on insurance quote"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Add task details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value: any) => setTaskForm({ ...taskForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign to Contact (Optional)</Label>
              <Select
                value={taskForm.contactId}
                onValueChange={(value) => setTaskForm({ ...taskForm, contactId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact or leave unassigned..." />
                </SelectTrigger>
                <SelectContent>
                  {loanContacts.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No contacts yet.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setShowTaskDialog(false);
                          setShowContactDialog(true);
                        }}
                      >
                        Add Contact First
                      </Button>
                    </div>
                  ) : (
                    loanContacts.map((contact) => {
                      const ContactIcon = getRoleIcon(contact.role);
                      return (
                        <SelectItem key={contact.id} value={contact.id}>
                          <div className="flex items-center gap-2">
                            <ContactIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.name}</span>
                            <span className="text-xs text-muted-foreground">• {contact.role}</span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              {taskForm.contactId && (() => {
                const selectedContact = loanContacts.find(c => c.id === taskForm.contactId);
                if (selectedContact) {
                  const ContactIcon = getRoleIcon(selectedContact.role);
                  return (
                    <div className="mt-2 p-3 rounded-md bg-accent/50 border">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {selectedContact.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{selectedContact.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ContactIcon className="h-3 w-3" />
                            {selectedContact.role}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            <Phone className="h-2.5 w-2.5 mr-1" />
                            {formatPhoneNumber(selectedContact.phone)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={taskForm.type}
                onValueChange={(value: any) => setTaskForm({ ...taskForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="document-review">Document Review</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowTaskDialog(false);
                setTaskForm({
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'medium',
                  contactId: '',
                  type: 'follow-up',
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!taskForm.title || !taskForm.dueDate) {
                  toast.error('Please fill in required fields');
                  return;
                }

                if (!selectedLoan) {
                  toast.error('No loan selected');
                  return;
                }

                if (!selectedLoan.dealId) {
                  toast.error('Selected loan has no dealId');
                  console.error('Loan missing dealId:', selectedLoan);
                  return;
                }

                const selectedContact = loanContacts.find(c => c.id === taskForm.contactId);

                console.log('Creating task with dealId:', selectedLoan.dealId);
                
                addTask({
                  title: taskForm.title,
                  description: taskForm.description || undefined,
                  contactId: taskForm.contactId || selectedLoan.id,
                  contactName: selectedContact?.name || selectedLoan.borrowerName,
                  dealId: selectedLoan.dealId,
                  dealName: `${selectedLoan.propertyAddress} Loan`,
                  dueDate: taskForm.dueDate,
                  type: taskForm.type,
                  priority: taskForm.priority,
                  assignedTo: currentUser?.name,
                });

                toast.success(`Task created successfully for deal ${selectedLoan.dealId}!`);
                setShowTaskDialog(false);
                setTaskForm({
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'medium',
                  contactId: '',
                  type: 'follow-up',
                });
              }}
            >
              Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={(open) => {
        setShowNoteDialog(open);
        if (!open) {
          setEditingNote(null);
          setNoteContent('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Add Note'}</DialogTitle>
            <DialogDescription>
              {editingNote ? 'Update the note content below' : 'Add an important note about this loan. You can pin it to keep it at the top.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter your note here..."
                rows={5}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNoteDialog(false);
                setEditingNote(null);
                setNoteContent('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedLoan && noteContent.trim()) {
                  if (editingNote) {
                    updateNote(editingNote.id, { content: noteContent });
                    toast.success('Note updated successfully');
                  } else {
                    addNote({
                      loanId: selectedLoan.id,
                      content: noteContent,
                      isPinned: false,
                      createdBy: currentUser.id,
                      createdByName: currentUser.name,
                    });
                    toast.success('Note added successfully');
                  }
                  setNoteContent('');
                  setEditingNote(null);
                  setShowNoteDialog(false);
                }
              }}
            >
              {editingNote ? 'Update Note' : 'Add Note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

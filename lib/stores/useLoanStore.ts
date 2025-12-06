import { useMemo, useCallback, useEffect, useState } from 'react';
import { Loan, LoanDocument, LoanContact, LoanNote, EmailTemplate, LENDER_REQUIRED_DOCS } from '@/types/loans';
import { useDealsStore } from '@/lib/stores/useDealsStore';
import { Deal } from '@/types/deals';

// Mock email templates
const mockEmailTemplates: EmailTemplate[] = [
  {
    id: 'et1',
    name: 'Title Company Request',
    category: 'Title',
    subject: 'Title Report Request for {{propertyAddress}}',
    body: `Dear Title Company,

We are requesting a title report for the following property:

Property Address: {{propertyAddress}}
Borrower: {{borrowerName}}
Loan Amount: {{loanAmount}}

Please provide the title report at your earliest convenience.

Best regards,
{{agentName}}`,
    variables: ['{{propertyAddress}}', '{{borrowerName}}', '{{loanAmount}}', '{{agentName}}'],
  },
  {
    id: 'et2',
    name: 'Insurance Quote Request',
    category: 'Insurance',
    subject: 'Homeowners Insurance Quote - {{propertyAddress}}',
    body: `Hello,

We need a homeowners insurance quote for:

Property: {{propertyAddress}}
Loan Amount: {{loanAmount}}
Closing Date: {{targetCloseDate}}

Please send the quote to {{borrowerEmail}}.

Thank you,
{{agentName}}`,
    variables: ['{{propertyAddress}}', '{{loanAmount}}', '{{targetCloseDate}}', '{{borrowerEmail}}', '{{agentName}}'],
  },
  {
    id: 'et3',
    name: 'Welcome to Borrower',
    category: 'Borrower',
    subject: 'Welcome - Your Loan Application',
    body: `Dear {{borrowerName}},

Thank you for choosing us for your {{loanType}} loan. We're excited to help you with your property at {{propertyAddress}}.

Next steps:
1. Upload required documents
2. Complete verification
3. Schedule appraisal

Your target closing date is {{targetCloseDate}}.

Best regards,
{{agentName}}`,
    variables: ['{{borrowerName}}', '{{loanType}}', '{{propertyAddress}}', '{{targetCloseDate}}', '{{agentName}}'],
  },
];

// Frequently used contacts (available across all loans)
export const frequentContacts: Omit<LoanContact, 'id' | 'loanId'>[] = [
  {
    name: 'Stephanie Zalai',
    email: 'stephanie@titleratenow.com',
    phone: '(917) 963-0181',
    role: 'Title Company',
    company: 'Title Rate Now',
    notes: 'Frequently used title company contact',
  },
  {
    name: 'Janet Garcia',
    email: 'janet@grandphoenixins.com',
    phone: '(602) 555-7890',
    role: 'Insurance Agent',
    company: 'Grand Phoenix Insurance',
    notes: 'Frequently used insurance agent',
  },
];

// Default initial data
const defaultNotes: LoanNote[] = [
  {
    id: 'note-1',
    loanId: 'deal-1',
    content: 'Borrower requested expedited processing due to lease ending soon. Target close moved up by 2 weeks.',
    isPinned: true,
    createdBy: 'user-1',
    createdByName: 'John Doe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'note-2',
    loanId: 'deal-1',
    content: 'Insurance agent (Janet Garcia) confirmed they can provide quote by end of week. Follow up on Friday.',
    isPinned: false,
    createdBy: 'user-2',
    createdByName: 'Jane Smith',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const defaultDocuments: LoanDocument[] = [
  {
    id: 'doc-1',
    loanId: 'deal-1',
    fileName: 'loan_application.pdf',
    fileType: 'application/pdf',
    fileSize: 245000,
    category: 'Application',
    status: 'Approved',
    uploadedBy: 'user-1',
    uploadedAt: '2024-01-15',
    notes: 'Initial application form',
    isRequired: true,
  },
  {
    id: 'doc-2',
    loanId: 'deal-1',
    fileName: 'bank_statements_december.pdf',
    fileType: 'application/pdf',
    fileSize: 892000,
    category: 'Bank Statements',
    status: 'Uploaded',
    uploadedBy: 'user-1',
    uploadedAt: '2024-01-18',
    notes: 'December 2024 statements',
    isRequired: true,
  },
  {
    id: 'doc-3',
    loanId: 'deal-1',
    fileName: 'tax_return_2023.pdf',
    fileType: 'application/pdf',
    fileSize: 1250000,
    category: 'Tax Returns',
    status: 'Uploaded',
    uploadedBy: 'user-1',
    uploadedAt: '2024-01-20',
    notes: '2023 tax return with all schedules',
    isRequired: true,
  },
  {
    id: 'doc-4',
    loanId: 'deal-1',
    fileName: 'credit_report.pdf',
    fileType: 'application/pdf',
    fileSize: 156000,
    category: 'Credit Report',
    status: 'Approved',
    uploadedBy: 'user-1',
    uploadedAt: '2024-01-16',
    isRequired: true,
  },
];

// LocalStorage keys
const NOTES_STORAGE_KEY = 'adler-capital-loan-notes';
const DOCUMENTS_STORAGE_KEY = 'adler-capital-loan-documents';
const CONTACTS_STORAGE_KEY = 'adler-capital-loan-contacts';
const TEMPLATES_STORAGE_KEY = 'adler-capital-email-templates';

// Load from localStorage or use defaults
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Save to localStorage
const saveToStorage = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

// Initialize stores from localStorage
let notesStore: LoanNote[] = loadFromStorage(NOTES_STORAGE_KEY, defaultNotes);
let documentsStore: LoanDocument[] = loadFromStorage(DOCUMENTS_STORAGE_KEY, defaultDocuments);
let contactsStore: LoanContact[] = loadFromStorage(CONTACTS_STORAGE_KEY, []);
let templatesStore: EmailTemplate[] = loadFromStorage(TEMPLATES_STORAGE_KEY, mockEmailTemplates);

// Helper function to convert Deal to Loan
function dealToLoan(deal: Deal): Loan | null {
  if (!deal.loanData) return null;
  
  // Map deal stage to loan stage
  const stageMap: Record<string, Loan['dealStage']> = {
    'new': 'New',
    'documents': 'Documents',
    'review': 'Review',
    'underwriting': 'Underwriting',
    'approved': 'Approved',
    'closing': 'Closing',
    'funded': 'Funded',
    'cancelled': 'Cancelled',
  };
  
  return {
    id: deal.id,
    dealId: deal.id,
    pipelineId: deal.pipelineId || 'pipeline-2',
    borrowerName: deal.contactName,
    borrowerEmail: deal.loanData.borrowerEmail,
    borrowerPhone: deal.loanData.borrowerPhone,
    borrowingEntity: deal.loanData.borrowingEntity,
    borrowerPrimaryResidence: deal.loanData.borrowerPrimaryResidence,
    propertyAddress: deal.loanData.propertyAddress,
    propertyCity: deal.loanData.propertyCity,
    propertyState: deal.loanData.propertyState,
    propertyZip: deal.loanData.propertyZip,
    loanAmount: deal.loanData.loanAmount,
    propertyValue: deal.loanData.propertyValue,
    ltv: deal.loanData.ltv,
    loanType: deal.loanData.loanType,
    interestOnly: deal.loanData.interestOnly,
    prepayPeriod: deal.loanData.prepayPeriod,
    lender: deal.loanData.lender,
    dealStage: stageMap[deal.stage] || 'New',
    targetCloseDate: deal.expectedCloseDate,
    assignedAnalysts: deal.assignedTo ? [deal.assignedTo] : [],
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    notes: deal.notes,
    propertyType: deal.loanData.propertyType,
    occupancyType: deal.loanData.occupancyType,
    monthlyRent: deal.loanData.monthlyRent,
    marketRent: deal.loanData.marketRent,
    interestRate: deal.loanData.interestRate,
    annualTaxes: deal.loanData.annualTaxes,
    annualInsurance: deal.loanData.annualInsurance,
    annualHOA: deal.loanData.annualHOA,
    monthlyManagementFee: deal.loanData.monthlyManagementFee,
    dscr: deal.loanData.dscr,
  };
}

// Helper function to convert Loan to Deal data
function loanToDeal(loanData: Omit<Loan, 'id' | 'dealId' | 'createdAt' | 'updatedAt' | 'ltv'>, pipelineId?: string): Omit<Deal, 'id' | 'createdAt' | 'updatedAt'> {
  // Map loan stage to deal stage
  const stageMap: Record<Loan['dealStage'], string> = {
    'New': 'new',
    'Documents': 'documents',
    'Review': 'review',
    'Underwriting': 'underwriting',
    'Approved': 'approved',
    'Closing': 'closing',
    'Funded': 'funded',
    'Cancelled': 'cancelled',
  };

  const ltv = (loanData.loanAmount / loanData.propertyValue) * 100;
  
  return {
    title: `${loanData.propertyAddress} - ${loanData.loanType}`,
    value: loanData.loanAmount,
    contactId: '1', // Default contact ID
    contactName: loanData.borrowerName,
    stage: stageMap[loanData.dealStage] || 'new',
    probability: 50,
    expectedCloseDate: loanData.targetCloseDate,
    notes: loanData.notes || '',
    tasks: [],
    assignedTo: loanData.assignedAnalysts[0],
    pipelineId: pipelineId || 'pipeline-2', // Default to Loan Processing pipeline
    archived: false,
    loanData: {
      borrowerEmail: loanData.borrowerEmail,
      borrowerPhone: loanData.borrowerPhone,
      borrowingEntity: loanData.borrowingEntity,
      borrowerPrimaryResidence: loanData.borrowerPrimaryResidence,
      propertyAddress: loanData.propertyAddress,
      propertyCity: loanData.propertyCity,
      propertyState: loanData.propertyState,
      propertyZip: loanData.propertyZip,
      loanAmount: loanData.loanAmount,
      propertyValue: loanData.propertyValue,
      ltv: Math.round(ltv * 100) / 100,
      loanType: loanData.loanType,
      interestOnly: loanData.interestOnly,
      prepayPeriod: loanData.prepayPeriod,
      lender: loanData.lender,
      propertyType: loanData.propertyType,
      occupancyType: loanData.occupancyType,
      monthlyRent: loanData.monthlyRent,
      marketRent: loanData.marketRent,
      interestRate: loanData.interestRate,
      annualTaxes: loanData.annualTaxes,
      annualInsurance: loanData.annualInsurance,
      annualHOA: loanData.annualHOA,
      monthlyManagementFee: loanData.monthlyManagementFee,
      dscr: loanData.dscr,
    },
  };
}

export function useLoanStore() {
  const dealsStore = useDealsStore();
  const { allDeals, pipelines, createDeal, updateDeal, deleteDeal } = dealsStore;
  
  // Force re-render trigger when data changes
  const [, forceUpdate] = useState(0);
  const triggerUpdate = useCallback(() => forceUpdate(prev => prev + 1), []);

  // Get all loan pipelines
  const loanPipelines = useMemo(() => 
    pipelines.filter(p => p.isLoanPipeline),
    [pipelines]
  );

  // Get all deals from loan pipelines and convert to loans
  const loans = useMemo(() => {
    const loanPipelineIds = loanPipelines.map(p => p.id);
    return allDeals
      .filter(deal => loanPipelineIds.includes(deal.pipelineId || ''))
      .map(dealToLoan)
      .filter((loan): loan is Loan => loan !== null);
  }, [allDeals, loanPipelines]);

  const createLoan = useCallback((loanData: Omit<Loan, 'id' | 'dealId' | 'createdAt' | 'updatedAt' | 'ltv'>, pipelineId?: string) => {
    const dealData = loanToDeal(loanData, pipelineId);
    const newDeal = createDeal(dealData);
    return dealToLoan(newDeal);
  }, [createDeal]);

  const updateLoan = useCallback((loanId: string, updates: Partial<Loan>) => {
    // Find the corresponding deal
    const deal = allDeals.find(d => d.id === loanId);
    if (!deal) return;

    // Map loan updates to deal updates
    const dealUpdates: Partial<Deal> = {};

    if (updates.borrowerName) dealUpdates.contactName = updates.borrowerName;
    if (updates.targetCloseDate) dealUpdates.expectedCloseDate = updates.targetCloseDate;
    if (updates.notes !== undefined) dealUpdates.notes = updates.notes;
    if (updates.loanAmount) dealUpdates.value = updates.loanAmount;

    // Map stage updates
    if (updates.dealStage) {
      const stageMap: Record<Loan['dealStage'], string> = {
        'New': 'new',
        'Documents': 'documents',
        'Review': 'review',
        'Underwriting': 'underwriting',
        'Approved': 'approved',
        'Closing': 'closing',
        'Funded': 'funded',
        'Cancelled': 'cancelled',
      };
      dealUpdates.stage = stageMap[updates.dealStage];
    }

    // Update loan data fields
    const currentLoanData = deal.loanData || {} as any;
    const newLoanData = { ...currentLoanData };
    let loanDataUpdated = false;

    if (updates.borrowerEmail) { newLoanData.borrowerEmail = updates.borrowerEmail; loanDataUpdated = true; }
    if (updates.borrowerPhone) { newLoanData.borrowerPhone = updates.borrowerPhone; loanDataUpdated = true; }
    if (updates.borrowingEntity !== undefined) { newLoanData.borrowingEntity = updates.borrowingEntity; loanDataUpdated = true; }
    if (updates.borrowerPrimaryResidence !== undefined) { newLoanData.borrowerPrimaryResidence = updates.borrowerPrimaryResidence; loanDataUpdated = true; }
    if (updates.propertyAddress) { newLoanData.propertyAddress = updates.propertyAddress; loanDataUpdated = true; }
    if (updates.propertyCity) { newLoanData.propertyCity = updates.propertyCity; loanDataUpdated = true; }
    if (updates.propertyState) { newLoanData.propertyState = updates.propertyState; loanDataUpdated = true; }
    if (updates.propertyZip) { newLoanData.propertyZip = updates.propertyZip; loanDataUpdated = true; }
    if (updates.loanAmount) { newLoanData.loanAmount = updates.loanAmount; loanDataUpdated = true; }
    if (updates.propertyValue) { newLoanData.propertyValue = updates.propertyValue; loanDataUpdated = true; }
    if (updates.loanType) { newLoanData.loanType = updates.loanType; loanDataUpdated = true; }
    if (updates.interestOnly !== undefined) { newLoanData.interestOnly = updates.interestOnly; loanDataUpdated = true; }
    if (updates.prepayPeriod !== undefined) { newLoanData.prepayPeriod = updates.prepayPeriod; loanDataUpdated = true; }
    if (updates.lender) { newLoanData.lender = updates.lender; loanDataUpdated = true; }
    if (updates.propertyType !== undefined) { newLoanData.propertyType = updates.propertyType; loanDataUpdated = true; }
    if (updates.occupancyType !== undefined) { newLoanData.occupancyType = updates.occupancyType; loanDataUpdated = true; }
    if (updates.monthlyRent !== undefined) { newLoanData.monthlyRent = updates.monthlyRent; loanDataUpdated = true; }
    if (updates.marketRent !== undefined) { newLoanData.marketRent = updates.marketRent; loanDataUpdated = true; }
    if (updates.interestRate !== undefined) { newLoanData.interestRate = updates.interestRate; loanDataUpdated = true; }
    if (updates.annualTaxes !== undefined) { newLoanData.annualTaxes = updates.annualTaxes; loanDataUpdated = true; }
    if (updates.annualInsurance !== undefined) { newLoanData.annualInsurance = updates.annualInsurance; loanDataUpdated = true; }
    if (updates.annualHOA !== undefined) { newLoanData.annualHOA = updates.annualHOA; loanDataUpdated = true; }
    if (updates.monthlyManagementFee !== undefined) { newLoanData.monthlyManagementFee = updates.monthlyManagementFee; loanDataUpdated = true; }
    if (updates.dscr !== undefined) { newLoanData.dscr = updates.dscr; loanDataUpdated = true; }

    // Recalculate LTV if needed
    if (updates.loanAmount || updates.propertyValue) {
      const amount = updates.loanAmount ?? currentLoanData.loanAmount;
      const value = updates.propertyValue ?? currentLoanData.propertyValue;
      newLoanData.ltv = Math.round((amount / value) * 100 * 100) / 100;
    }

    if (loanDataUpdated) {
      dealUpdates.loanData = newLoanData;
    }

    // Update title if property address changed
    if (updates.propertyAddress || updates.loanType) {
      const address = updates.propertyAddress || currentLoanData.propertyAddress;
      const type = updates.loanType || currentLoanData.loanType;
      dealUpdates.title = `${address} - ${type}`;
    }

    updateDeal(loanId, dealUpdates);
  }, [allDeals, updateDeal]);

  const deleteLoan = useCallback((loanId: string) => {
    deleteDeal(loanId);
  }, [deleteDeal]);

  // Document management (separate from deals)
  const addDocument = useCallback((docData: Omit<LoanDocument, 'id' | 'uploadedAt'>) => {
    const newDoc: LoanDocument = {
      ...docData,
      id: `doc-${Date.now()}-${Math.random()}`,
      uploadedAt: new Date().toISOString().split('T')[0],
    };
    documentsStore = [...documentsStore, newDoc];
    saveToStorage(DOCUMENTS_STORAGE_KEY, documentsStore);
    triggerUpdate();
    return newDoc;
  }, [triggerUpdate]);

  const updateDocument = useCallback((docId: string, updates: Partial<LoanDocument>) => {
    documentsStore = documentsStore.map(doc =>
      doc.id === docId ? { ...doc, ...updates } : doc
    );
    saveToStorage(DOCUMENTS_STORAGE_KEY, documentsStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const deleteDocument = useCallback((docId: string) => {
    documentsStore = documentsStore.filter(d => d.id !== docId);
    saveToStorage(DOCUMENTS_STORAGE_KEY, documentsStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const getDocumentsByLoan = useCallback((loanId: string) => {
    return documentsStore.filter(d => d.loanId === loanId);
  }, []);

  // Email template management
  const createEmailTemplate = useCallback((templateData: Omit<EmailTemplate, 'id'>) => {
    const newTemplate: EmailTemplate = {
      ...templateData,
      id: `template-${Date.now()}`,
    };
    templatesStore = [...templatesStore, newTemplate];
    saveToStorage(TEMPLATES_STORAGE_KEY, templatesStore);
    triggerUpdate();
    return newTemplate;
  }, [triggerUpdate]);

  const updateEmailTemplate = useCallback((templateId: string, updates: Partial<EmailTemplate>) => {
    templatesStore = templatesStore.map(t =>
      t.id === templateId ? { ...t, ...updates } : t
    );
    saveToStorage(TEMPLATES_STORAGE_KEY, templatesStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const deleteEmailTemplate = useCallback((templateId: string) => {
    templatesStore = templatesStore.filter(t => t.id !== templateId);
    saveToStorage(TEMPLATES_STORAGE_KEY, templatesStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const populateTemplate = useCallback((template: EmailTemplate, loan: Loan, agentName: string = 'Loan Agent') => {
    let subject = template.subject;
    let body = template.body;

    const replacements: Record<string, string> = {
      '{{borrowerName}}': loan.borrowerName,
      '{{borrowerEmail}}': loan.borrowerEmail,
      '{{propertyAddress}}': `${loan.propertyAddress}, ${loan.propertyCity}, ${loan.propertyState} ${loan.propertyZip}`,
      '{{loanAmount}}': `${loan.loanAmount.toLocaleString()}`,
      '{{loanType}}': loan.loanType,
      '{{targetCloseDate}}': loan.targetCloseDate,
      '{{lender}}': loan.lender,
      '{{agentName}}': agentName,
    };

    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, 'g'), value);
      body = body.replace(new RegExp(key, 'g'), value);
    });

    return { subject, body };
  }, []);

  // Contact Management (separate from deals)
  const addContact = useCallback((contactData: Omit<LoanContact, 'id'>) => {
    const newContact: LoanContact = {
      ...contactData,
      id: `contact-${Date.now()}-${Math.random()}`,
    };
    contactsStore = [...contactsStore, newContact];
    saveToStorage(CONTACTS_STORAGE_KEY, contactsStore);
    triggerUpdate();
    return newContact;
  }, [triggerUpdate]);

  const updateContact = useCallback((contactId: string, updates: Partial<LoanContact>) => {
    contactsStore = contactsStore.map(c =>
      c.id === contactId ? { ...c, ...updates } : c
    );
    saveToStorage(CONTACTS_STORAGE_KEY, contactsStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const deleteContact = useCallback((contactId: string) => {
    contactsStore = contactsStore.filter(c => c.id !== contactId);
    saveToStorage(CONTACTS_STORAGE_KEY, contactsStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const getContactsByLoan = useCallback((loanId: string) => {
    return contactsStore.filter(c => c.loanId === loanId);
  }, []);

  const addFrequentContact = useCallback((loanId: string, frequentContact: typeof frequentContacts[0]) => {
    return addContact({
      loanId,
      ...frequentContact,
    });
  }, [addContact]);

  // Note Management
  const addNote = useCallback((noteData: Omit<LoanNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: LoanNote = {
      ...noteData,
      id: `note-${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notesStore = [...notesStore, newNote];
    saveToStorage(NOTES_STORAGE_KEY, notesStore);
    triggerUpdate();
    return newNote;
  }, [triggerUpdate]);

  const updateNote = useCallback((noteId: string, updates: Partial<LoanNote>) => {
    notesStore = notesStore.map(note =>
      note.id === noteId ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
    );
    saveToStorage(NOTES_STORAGE_KEY, notesStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const deleteNote = useCallback((noteId: string) => {
    notesStore = notesStore.filter(n => n.id !== noteId);
    saveToStorage(NOTES_STORAGE_KEY, notesStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const togglePinNote = useCallback((noteId: string) => {
    notesStore = notesStore.map(note =>
      note.id === noteId ? { ...note, isPinned: !note.isPinned, updatedAt: new Date().toISOString() } : note
    );
    saveToStorage(NOTES_STORAGE_KEY, notesStore);
    triggerUpdate();
  }, [triggerUpdate]);

  const getNotesByLoan = useCallback((loanId: string) => {
    return notesStore.filter(n => n.loanId === loanId);
  }, []);

  return {
    loans,
    loanPipelines,
    documents: documentsStore,
    emailTemplates: templatesStore,
    contacts: contactsStore,
    notes: notesStore,
    frequentContacts,
    LENDER_REQUIRED_DOCS,
    createLoan,
    updateLoan,
    deleteLoan,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocumentsByLoan,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
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
  };
}

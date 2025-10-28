export type LoanStage = 'New' | 'Documents' | 'Review' | 'Underwriting' | 'Approved' | 'Closing' | 'Funded' | 'Cancelled'

export interface Loan {
  id: string;
  dealId: string; // mirrors Deal.id
  pipelineId: string;
  borrowerName: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  borrowingEntity?: string;
  borrowerPrimaryResidence?: boolean;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  loanAmount: number;
  propertyValue: number;
  ltv?: number;
  loanType: 'Purchase' | 'Refinance' | 'Cash Out' | string;
  interestOnly?: boolean;
  prepayPeriod?: number;
  lender?: string;
  dealStage: LoanStage;
  targetCloseDate?: string;
  assignedAnalysts: string[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
  propertyType?: string;
  occupancyType?: string;
  monthlyRent?: number;
  marketRent?: number;
  interestRate?: number;
  annualTaxes?: number;
  annualInsurance?: number;
  annualHOA?: number;
  monthlyManagementFee?: number;
  dscr?: number;
}

export type DocumentStatus = 'Uploaded' | 'Approved' | 'Rejected' | 'Pending'

export interface LoanDocument {
  id: string;
  loanId: string;
  fileName: string;
  fileType: string;
  fileSize: number; // bytes
  category: string; // e.g., 'Application', 'Bank Statements', ...
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: string; // YYYY-MM-DD
  notes?: string;
  isRequired?: boolean;
}

export interface LoanContact {
  id: string;
  loanId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string; // Title Company, Insurance Agent, Appraiser, Borrower, etc.
  company?: string;
  notes?: string;
}

export interface LoanNote {
  id: string;
  loanId: string;
  content: string;
  isPinned?: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface Funder {
  id: string;
  name: string;
  description?: string;
  requiredDocuments: string[];
  createdAt: string;
  updatedAt: string;
}

// Minimal lender requirements mapping for UI reference
export const LENDER_REQUIRED_DOCS: Record<string, string[]> = {
  Kiavi: [
    'Application',
    'Bank Statements',
    'Tax Returns',
    'Credit Report',
    'Insurance',
    'Appraisal',
  ],
  Visio: [
    'Application',
    'Bank Statements',
    'Credit Report',
    'Title',
  ],
  'ROC Capital': [
    'Application',
    'Bank Statements',
    'Tax Returns',
    'Appraisal',
    'Title',
  ],
};


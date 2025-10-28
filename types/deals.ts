export interface DealTask {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

export interface PipelineStage {
  id: string; // e.g., 'lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closing', 'closed-won', 'closed-lost'
  name: string;
  order: number;
  color?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  createdAt: string;
  isDefault?: boolean;
  isLoanPipeline?: boolean;
}

export interface DealLoanData {
  borrowerEmail?: string;
  borrowerPhone?: string;
  borrowingEntity?: string;
  borrowerPrimaryResidence?: boolean;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  loanAmount: number;
  propertyValue: number;
  ltv?: number;
  loanType: 'Purchase' | 'Refinance' | 'Cash Out' | string;
  interestOnly?: boolean;
  prepayPeriod?: number;
  lender?: string;
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

export interface Deal {
  id: string;
  title: string;
  value: number; // amount
  contactId: string;
  contactName: string;
  stage: string; // matches PipelineStage.id
  probability: number; // 0-100
  expectedCloseDate?: string; // YYYY-MM-DD
  notes?: string;
  tasks: DealTask[];
  createdAt: string; // YYYY-MM-DD
  updatedAt: string; // YYYY-MM-DD
  assignedTo?: string;
  pipelineId?: string;
  archived: boolean;
  loanData?: DealLoanData;
}

export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'lead', name: 'Lead', order: 0, color: '#e5e7eb' },
  { id: 'contacted', name: 'Contacted', order: 1, color: '#c7d2fe' },
  { id: 'qualified', name: 'Qualified', order: 2, color: '#bfdbfe' },
  { id: 'proposal', name: 'Proposal', order: 3, color: '#fde68a' },
  { id: 'negotiation', name: 'Negotiation', order: 4, color: '#fdba74' },
  { id: 'closing', name: 'Closing', order: 5, color: '#fca5a5' },
  { id: 'closed-won', name: 'Closed Won', order: 6, color: '#86efac' },
  { id: 'closed-lost', name: 'Closed Lost', order: 7, color: '#fecaca' },
];


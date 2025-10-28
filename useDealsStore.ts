import { useState, useEffect, useMemo } from 'react';
import { Deal, PipelineStage, DEFAULT_STAGES, DealTask, Pipeline } from '@/types/deals';
import { mockContacts } from '@/lib/mock-contacts';

// LocalStorage keys
const DEALS_STORAGE_KEY = 'adler-capital-deals';
const PIPELINES_STORAGE_KEY = 'adler-capital-pipelines';

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

// Mock pipelines
const mockPipelines: Pipeline[] = [
  {
    id: 'pipeline-1',
    name: 'Sales Pipeline',
    description: 'Main sales pipeline for all deals',
    stages: [...DEFAULT_STAGES],
    createdAt: '2025-01-01',
    isDefault: true,
    isLoanPipeline: true, // This pipeline shows in Loan Co-Pilot
  },
  {
    id: 'pipeline-2',
    name: 'Loan Processing',
    description: 'DSCR Real Estate Investment Loans',
    stages: [
      { id: 'new', name: 'New', order: 0, color: '#94a3b8' },
      { id: 'documents', name: 'Documents', order: 1, color: '#60a5fa' },
      { id: 'review', name: 'Review', order: 2, color: '#a78bfa' },
      { id: 'underwriting', name: 'Underwriting', order: 3, color: '#f59e0b' },
      { id: 'approved', name: 'Approved', order: 4, color: '#10b981' },
      { id: 'closing', name: 'Closing', order: 5, color: '#fb923c' },
      { id: 'funded', name: 'Funded', order: 6, color: '#22c55e' },
      { id: 'cancelled', name: 'Cancelled', order: 7, color: '#ef4444' },
    ],
    createdAt: '2025-01-01',
    isDefault: false,
    isLoanPipeline: true, // This pipeline shows in Loan Co-Pilot
  },
];

// Mock deals data
const mockDeals: Deal[] = [
  {
    id: '1',
    title: '123 Main St - Triplex',
    value: 850000,
    contactId: '1',
    contactName: `${mockContacts[0]?.firstName} ${mockContacts[0]?.lastName}` || 'Sarah Johnson',
    stage: 'qualified',
    probability: 70,
    expectedCloseDate: '2025-10-20',
    notes: 'Strong lead. Ready to move forward with purchase.',
    tasks: [
      { id: 't1', title: 'Send inspection report', dueDate: '2025-10-12', completed: false, createdAt: '2025-10-07' },
      { id: 't2', title: 'Schedule final walkthrough', dueDate: '2025-10-15', completed: false, createdAt: '2025-10-07' },
    ],
    createdAt: '2025-09-15',
    updatedAt: '2025-10-07',
    assignedTo: '1',
    pipelineId: 'pipeline-1',
    archived: false,
    loanData: {
      borrowerEmail: 'sarah.j@email.com',
      borrowerPhone: '(555) 123-4567',
      propertyAddress: '123 Main St',
      propertyCity: 'Los Angeles',
      propertyState: 'CA',
      propertyZip: '90001',
      loanAmount: 850000,
      propertyValue: 1100000,
      ltv: 77.27,
      loanType: 'Purchase',
      lender: 'Kiavi',
      propertyType: 'Multi-Family',
      occupancyType: 'Leased',
      monthlyRent: 4500,
      marketRent: 4800,
      interestRate: 7.5,
      annualTaxes: 12000,
      annualInsurance: 2400,
      annualHOA: 0,
      dscr: 1.25,
    },
  },
  {
    id: '2',
    title: '456 Oak St - Commercial',
    value: 2500000,
    contactId: '4',
    contactName: `${mockContacts[3]?.firstName} ${mockContacts[3]?.lastName}` || 'David Park',
    stage: 'proposal',
    probability: 60,
    expectedCloseDate: '2025-11-01',
    notes: 'Large commercial deal. Waiting on financing approval.',
    tasks: [
      { id: 't3', title: 'Follow up with bank', dueDate: '2025-10-10', completed: false, createdAt: '2025-10-05' },
    ],
    createdAt: '2025-09-01',
    updatedAt: '2025-10-05',
    assignedTo: '2',
    pipelineId: 'pipeline-1',
    archived: false,
  },
  {
    id: '3',
    title: '789 Pine Ave - Duplex',
    value: 650000,
    contactId: '2',
    contactName: `${mockContacts[1]?.firstName} ${mockContacts[1]?.lastName}` || 'Michael Chen',
    stage: 'contacted',
    probability: 30,
    expectedCloseDate: '2025-10-30',
    notes: 'Initial contact made. Interested in duplex investment.',
    tasks: [],
    createdAt: '2025-10-01',
    updatedAt: '2025-10-03',
    assignedTo: '1',
    pipelineId: 'pipeline-1',
    archived: false,
  },
  {
    id: '4',
    title: '321 Elm St - Single Family',
    value: 425000,
    contactId: '3',
    contactName: `${mockContacts[2]?.firstName} ${mockContacts[2]?.lastName}` || 'Emily Rodriguez',
    stage: 'lead',
    probability: 20,
    expectedCloseDate: '2025-11-15',
    notes: 'New lead from website inquiry.',
    tasks: [
      { id: 't4', title: 'Initial consultation call', dueDate: '2025-10-09', completed: false, createdAt: '2025-10-07' },
    ],
    createdAt: '2025-10-05',
    updatedAt: '2025-10-07',
    assignedTo: '3',
    pipelineId: 'pipeline-1',
    archived: false,
  },
  // Loan pipeline deals
  {
    id: 'loan-1',
    title: '456 Oak Avenue - Refinance',
    value: 850000,
    contactId: '2',
    contactName: 'Michael Chen',
    stage: 'review',
    probability: 80,
    expectedCloseDate: '2025-10-25',
    notes: 'DSCR loan for investment property refinance',
    tasks: [
      { id: 'lt1', title: 'Review tax returns', dueDate: '2025-10-16', completed: false, createdAt: '2025-10-10' },
    ],
    createdAt: '2025-09-01',
    updatedAt: '2025-10-05',
    assignedTo: '1',
    pipelineId: 'pipeline-2',
    archived: false,
    loanData: {
      borrowerEmail: 'mchen@email.com',
      borrowerPhone: '(555) 234-5678',
      propertyAddress: '456 Oak Avenue',
      propertyCity: 'San Francisco',
      propertyState: 'CA',
      propertyZip: '94102',
      loanAmount: 850000,
      propertyValue: 1100000,
      ltv: 77.27,
      loanType: 'Refinance',
      lender: 'Visio',
      propertyType: 'Single Family',
      occupancyType: 'Short Term Rental',
      monthlyRent: 5200,
      marketRent: 4500,
      interestRate: 7.25,
      annualTaxes: 15000,
      annualInsurance: 3000,
      annualHOA: 1200,
      monthlyManagementFee: 520,
      dscr: 1.18,
    },
  },
  {
    id: 'loan-2',
    title: '789 Pine Street - Cash Out',
    value: 325000,
    contactId: '3',
    contactName: 'Emily Rodriguez',
    stage: 'new',
    probability: 50,
    expectedCloseDate: '2025-11-30',
    notes: 'Cash-out refinance for property improvements',
    tasks: [],
    createdAt: '2025-10-05',
    updatedAt: '2025-10-07',
    assignedTo: '3',
    pipelineId: 'pipeline-2',
    archived: false,
    loanData: {
      borrowerEmail: 'emily.r@email.com',
      borrowerPhone: '(555) 345-6789',
      propertyAddress: '789 Pine Street',
      propertyCity: 'San Diego',
      propertyState: 'CA',
      propertyZip: '92101',
      loanAmount: 325000,
      propertyValue: 425000,
      ltv: 76.47,
      loanType: 'Cash Out',
      lender: 'ROC Capital',
      propertyType: 'Condo',
      occupancyType: 'Vacant',
      monthlyRent: 0,
      marketRent: 2200,
      interestRate: 7.75,
      annualTaxes: 4500,
      annualInsurance: 1800,
      annualHOA: 3600,
      dscr: 0.95,
    },
  },
];

// Initialize from localStorage
let dealsStore = loadFromStorage(DEALS_STORAGE_KEY, mockDeals);
let pipelinesStore = loadFromStorage(PIPELINES_STORAGE_KEY, mockPipelines);

export function useDealsStore() {
  // Initialize with empty array first, then fetch from API
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>(() => loadFromStorage(PIPELINES_STORAGE_KEY, mockPipelines));
  const [activePipelineId, setActivePipelineId] = useState<string>(pipelinesStore[0]?.id || 'pipeline-1');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch deals from API on mount
  useEffect(() => {
    const fetchDealsFromAPI = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 Fetching deals from API...');
        const response = await fetch('/api/deals?pipeline=default&limit=100');
        console.log('📡 API Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📦 API Response data:', data);

          if (data.deals && Array.isArray(data.deals) && data.deals.length > 0) {
            console.log(`✅ Found ${data.deals.length} deals from API`);
            // Transform API deals to match store format
            const apiDeals = data.deals.map((deal: any) => ({
              id: deal.id,
              title: deal.title,
              value: deal.value,
              contactId: deal.contactId,
              contactName: deal.contactName,
              stage: deal.stage,
              probability: deal.probability,
              expectedCloseDate: deal.expectedCloseDate,
              notes: deal.notes,
              tasks: deal.tasks || [],
              assignedTo: deal.assignedTo,
              pipelineId: deal.pipelineId,
              archived: deal.archived,
              loanData: deal.loanData,
              createdAt: deal.createdAt,
              updatedAt: deal.updatedAt,
            }));
            console.log('📝 Setting deals:', apiDeals);
            setDeals(apiDeals);
          } else {
            console.warn('⚠️ No deals array in response or empty, using mock data');
            setDeals(mockDeals);
          }
        } else {
          console.error('❌ API returned status:', response.status);
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Error details:', errorData);
          setDeals(mockDeals);
        }
      } catch (error) {
        console.error('❌ Error fetching deals from API:', error);
        // Fall back to mock data
        setDeals(mockDeals);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDealsFromAPI();
  }, []);

  // Sync to localStorage whenever deals change
  useEffect(() => {
    saveToStorage(DEALS_STORAGE_KEY, deals);
    dealsStore = deals;
  }, [deals]);

  // Sync to localStorage whenever pipelines change
  useEffect(() => {
    saveToStorage(PIPELINES_STORAGE_KEY, pipelines);
    pipelinesStore = pipelines;
  }, [pipelines]);

  const activePipeline = useMemo(
    () => pipelines.find(p => p.id === activePipelineId),
    [pipelines, activePipelineId]
  );

  const stages = useMemo(
    () => activePipeline?.stages || DEFAULT_STAGES,
    [activePipeline]
  );

  // Memoize filtered deals to prevent unnecessary re-renders
  const filteredDeals = useMemo(() =>
    deals.filter(d => d.pipelineId === activePipelineId && !d.archived),
    [deals, activePipelineId]
  );

  const createDeal = (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: `deal-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      pipelineId: dealData.pipelineId || activePipelineId,
      archived: false,
    };
    const updated = [...deals, newDeal];
    setDeals(updated);
    return newDeal;
  };

  const updateDeal = (dealId: string, updates: Partial<Deal>) => {
    const updated = deals.map(deal =>
      deal.id === dealId
        ? { ...deal, ...updates, updatedAt: new Date().toISOString().split('T')[0] }
        : deal
    );
    setDeals(updated);
  };

  const deleteDeal = (dealId: string) => {
    const updated = deals.filter(d => d.id !== dealId);
    setDeals(updated);
  };

  const archiveDeal = (dealId: string) => {
    updateDeal(dealId, { archived: true });
  };

  const unarchiveDeal = (dealId: string) => {
    updateDeal(dealId, { archived: false });
  };

  const moveDeal = (dealId: string, newStage: string) => {
    updateDeal(dealId, { stage: newStage });
  };

  const addTaskToDeal = (dealId: string, taskData: Omit<DealTask, 'id' | 'createdAt'>) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const newTask: DealTask = {
      ...taskData,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    updateDeal(dealId, {
      tasks: [...deal.tasks, newTask],
    });
  };

  const updateTask = (dealId: string, taskId: string, updates: Partial<DealTask>) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const updatedTasks = deal.tasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    );

    updateDeal(dealId, { tasks: updatedTasks });
  };

  const deleteTask = (dealId: string, taskId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    updateDeal(dealId, {
      tasks: deal.tasks.filter(t => t.id !== taskId),
    });
  };

  const createPipeline = (pipelineData: Omit<Pipeline, 'id' | 'createdAt'>) => {
    const newPipeline: Pipeline = {
      ...pipelineData,
      id: `pipeline-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [...pipelines, newPipeline];
    setPipelines(updated);
    return newPipeline;
  };

  const updatePipeline = (pipelineId: string, updates: Partial<Pipeline>) => {
    const updated = pipelines.map(p => 
      p.id === pipelineId ? { ...p, ...updates } : p
    );
    setPipelines(updated);
    pipelinesStore = updated;
  };

  const deletePipeline = (pipelineId: string) => {
    if (pipelines.length <= 1) return; // Prevent deleting last pipeline

    // Move deals to default pipeline
    const defaultPipeline = pipelines.find(p => p.isDefault && p.id !== pipelineId) || pipelines.find(p => p.id !== pipelineId);
    if (defaultPipeline) {
      const updatedDeals = deals.map(d =>
        d.pipelineId === pipelineId ? { ...d, pipelineId: defaultPipeline.id, stage: defaultPipeline.stages[0]?.id || 'lead' } : d
      );
      setDeals(updatedDeals);
      dealsStore = updatedDeals;
    }

    const updated = pipelines.filter(p => p.id !== pipelineId);
    setPipelines(updated);
    pipelinesStore = updated;

    // Switch to default pipeline if deleting active
    if (pipelineId === activePipelineId) {
      setActivePipelineId(updated[0]?.id || '');
    }
  };

  const addStage = (stageData: Omit<PipelineStage, 'id' | 'order'>) => {
    if (!activePipeline) return;

    const newStage: PipelineStage = {
      ...stageData,
      id: `stage-${Date.now()}`,
      order: activePipeline.stages.length,
    };
    
    updatePipeline(activePipelineId, {
      stages: [...activePipeline.stages, newStage],
    });
  };

  const updateStage = (stageId: string, updates: Partial<PipelineStage>) => {
    if (!activePipeline) return;

    const updatedStages = activePipeline.stages.map(s => 
      s.id === stageId ? { ...s, ...updates } : s
    );
    
    updatePipeline(activePipelineId, { stages: updatedStages });
  };

  const deleteStage = (stageId: string) => {
    if (!activePipeline || activePipeline.stages.length <= 1) return;

    // Move deals from deleted stage to first stage
    const firstStageId = activePipeline.stages.find(s => s.id !== stageId)?.id;
    if (firstStageId) {
      const updatedDeals = deals.map(d =>
        d.stage === stageId && d.pipelineId === activePipelineId ? { ...d, stage: firstStageId } : d
      );
      setDeals(updatedDeals);
      dealsStore = updatedDeals;
    }

    updatePipeline(activePipelineId, {
      stages: activePipeline.stages.filter(s => s.id !== stageId),
    });
  };

  const reorderStages = (newOrder: PipelineStage[]) => {
    if (!activePipeline) return;

    const updated = newOrder.map((stage, index) => ({ ...stage, order: index }));
    updatePipeline(activePipelineId, { stages: updated });
  };

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('🏪 Store State:', {
      totalDeals: deals.length,
      filteredDeals: filteredDeals.length,
      activePipelineId,
      isLoading,
      firstDeal: deals[0],
      firstFilteredDeal: filteredDeals[0]
    });
  }

  return {
    deals: filteredDeals,
    allDeals: deals,
    stages,
    pipelines,
    activePipelineId,
    activePipeline,
    setActivePipelineId,
    createDeal,
    updateDeal,
    deleteDeal,
    archiveDeal,
    unarchiveDeal,
    moveDeal,
    addTaskToDeal,
    updateTask,
    deleteTask,
    createPipeline,
    updatePipeline,
    deletePipeline,
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    isLoading,
  };
}

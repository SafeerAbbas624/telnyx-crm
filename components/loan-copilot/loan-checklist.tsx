'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Wand2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LoanChecklistProps {
  dealId: string;
  loanType?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  completed: boolean;
  required: boolean;
  notes?: string;
}

const DEFAULT_DSCR_CHECKLIST: Omit<ChecklistItem, 'id' | 'completed'>[] = [
  { label: 'Loan Application', category: 'Application', required: true },
  { label: 'Government ID (Front & Back)', category: 'Borrower', required: true },
  { label: 'Entity Documents (Articles, Operating Agreement)', category: 'Borrower', required: true },
  { label: 'Credit Authorization', category: 'Borrower', required: true },
  { label: 'Purchase Contract', category: 'Property', required: true },
  { label: 'Property Insurance Quote', category: 'Property', required: true },
  { label: 'Rent Roll / Lease Agreements', category: 'Property', required: true },
  { label: 'Appraisal Ordered', category: 'Property', required: true },
  { label: 'Title Ordered', category: 'Property', required: true },
  { label: 'Bank Statements (2 months)', category: 'Financial', required: true },
  { label: 'Proof of Funds for Down Payment', category: 'Financial', required: true },
  { label: 'REO Schedule', category: 'Financial', required: false },
  { label: 'Track Record / Experience', category: 'Financial', required: false },
  { label: 'Conditional Approval Received', category: 'Lender', required: true },
  { label: 'Clear to Close', category: 'Lender', required: true },
  { label: 'Closing Disclosure Signed', category: 'Closing', required: true },
  { label: 'Wire Instructions Sent', category: 'Closing', required: true },
];

export default function LoanChecklist({ dealId, loanType }: LoanChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadChecklist();
  }, [dealId]);

  const loadChecklist = async () => {
    // TODO: Load from API
    // For now, initialize with default checklist
    const defaultItems = DEFAULT_DSCR_CHECKLIST.map((item, index) => ({
      ...item,
      id: `item-${index}`,
      completed: false,
    }));
    setChecklist(defaultItems);
  };

  const handleToggle = async (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ));
    // TODO: Save to API
  };

  const generateChecklist = async () => {
    toast.info('AI checklist generation coming soon');
  };

  const completedCount = checklist.filter(item => item.completed).length;
  const requiredCount = checklist.filter(item => item.required).length;
  const completedRequiredCount = checklist.filter(item => item.required && item.completed).length;
  const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

  const categories = [...new Set(checklist.map(item => item.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Loan Checklist</h2>
          <p className="text-sm text-muted-foreground">
            Track required documents and milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={generateChecklist}>
            <Wand2 className="h-4 w-4" />
            Generate with AI
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {checklist.length} items ({Math.round(progress)}%)
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {completedRequiredCount}/{requiredCount} required items
            </span>
            {completedRequiredCount < requiredCount && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertCircle className="h-3 w-3" />
                {requiredCount - completedRequiredCount} required items pending
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checklist by Category */}
      <div className="space-y-4">
        {categories.map((category) => {
          const categoryItems = checklist.filter(item => item.category === category);
          const categoryCompleted = categoryItems.filter(item => item.completed).length;
          
          return (
            <Card key={category}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{category}</CardTitle>
                  <Badge variant="outline">
                    {categoryCompleted}/{categoryItems.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => handleToggle(item.id)}
                      />
                      <span className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.label}
                      </span>
                      {item.required && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


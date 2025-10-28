"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Edit2, Save, X, Plus } from "lucide-react"
import { Deal } from "@/types/deals"
import { formatCurrency } from "@/currency"
import CreateTaskDialog from "./create-task-dialog"

interface LoanDetailsTabProps {
  loan: Deal
  onUpdate: (updates: Partial<Deal>) => void
  onCreateTask?: (taskData: { title: string; description: string; dueDate: string }) => void
}

export default function LoanDetailsTab({ loan, onUpdate, onCreateTask }: LoanDetailsTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [formData, setFormData] = useState({
    loanAmount: loan.loanAmount || 0,
    propertyValue: loan.propertyValue || 0,
    interestRate: loan.interestRate || 0,
    annualTaxes: loan.annualTaxes || 0,
    annualInsurance: loan.annualInsurance || 0,
    annualHOA: loan.annualHOA || 0,
    monthlyRent: loan.monthlyRent || 0,
    monthlyManagementFee: loan.monthlyManagementFee || 0,
  })

  // Calculate DSCR
  const calculateDSCR = () => {
    const monthlyIncome = formData.monthlyRent
    const monthlyExpenses =
      (formData.annualTaxes + formData.annualInsurance + formData.annualHOA) / 12 +
      formData.monthlyManagementFee

    // Estimate monthly debt service (simplified)
    const monthlyDebtService = (formData.loanAmount * (formData.interestRate / 100)) / 12

    if (monthlyDebtService === 0) return 0
    return (monthlyIncome - monthlyExpenses) / monthlyDebtService
  }

  const dscr = calculateDSCR()
  const ltv = formData.propertyValue > 0 ? (formData.loanAmount / formData.propertyValue) * 100 : 0

  const handleSave = () => {
    onUpdate({
      ...loan,
      loanAmount: formData.loanAmount,
      propertyValue: formData.propertyValue,
      interestRate: formData.interestRate,
      annualTaxes: formData.annualTaxes,
      annualInsurance: formData.annualInsurance,
      annualHOA: formData.annualHOA,
      monthlyRent: formData.monthlyRent,
      monthlyManagementFee: formData.monthlyManagementFee,
      ltv,
      dscr,
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Loan Details</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Loan Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Loan Amount</Label>
                <Input
                  type="number"
                  value={formData.loanAmount}
                  onChange={(e) => setFormData({ ...formData, loanAmount: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Interest Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Property Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Property Value</Label>
                <Input
                  type="number"
                  value={formData.propertyValue}
                  onChange={(e) => setFormData({ ...formData, propertyValue: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Annual Expenses</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Annual Taxes</Label>
                <Input
                  type="number"
                  value={formData.annualTaxes}
                  onChange={(e) => setFormData({ ...formData, annualTaxes: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Annual Insurance</Label>
                <Input
                  type="number"
                  value={formData.annualInsurance}
                  onChange={(e) => setFormData({ ...formData, annualInsurance: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Annual HOA</Label>
                <Input
                  type="number"
                  value={formData.annualHOA}
                  onChange={(e) => setFormData({ ...formData, annualHOA: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Monthly Income & Expenses</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Monthly Rent</Label>
                <Input
                  type="number"
                  value={formData.monthlyRent}
                  onChange={(e) => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Monthly Management Fee</Label>
                <Input
                  type="number"
                  value={formData.monthlyManagementFee}
                  onChange={(e) => setFormData({ ...formData, monthlyManagementFee: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Loan Details</h3>
        <div className="flex gap-2">
          {onCreateTask && (
            <Button
              size="sm"
              onClick={() => setShowTaskDialog(true)}
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Task
            </Button>
          )}
          <Button size="sm" onClick={() => setIsEditing(true)} variant="outline">
            <Edit2 className="mr-2 h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loan Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatCurrency(loan.loanAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{loan.loanType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lender</span><span>{loan.lender || 'TBD'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Interest Rate</span><span>{loan.interestRate}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DSCR</span><span className={`font-bold ${loan.dscr && loan.dscr >= 1.25 ? 'text-green-600' : 'text-orange-600'}`}>{loan.dscr?.toFixed(2)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Borrower Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{loan.borrowerName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-blue-600 text-xs">{loan.borrowerEmail || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{loan.borrowerPhone || '—'}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Property Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="text-xs">{loan.propertyAddress}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Value</span><span className="font-semibold">{formatCurrency(loan.propertyValue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{loan.propertyType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">LTV</span><span className="font-semibold">{loan.ltv?.toFixed(2)}%</span></div>
          </CardContent>
        </Card>
      </div>

      {/* DSCR Calculation Details */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3"><CardTitle className="text-sm">DSCR Calculation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-muted-foreground text-xs">Monthly Income</div>
              <div className="font-bold text-lg text-green-600">{formatCurrency(formData.monthlyRent)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Monthly Expenses</div>
              <div className="font-bold text-lg text-orange-600">
                {formatCurrency(
                  (formData.annualTaxes + formData.annualInsurance + formData.annualHOA) / 12 +
                    formData.monthlyManagementFee
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">DSCR Ratio</div>
              <div className={`font-bold text-lg ${dscr >= 1.25 ? 'text-green-600' : 'text-orange-600'}`}>
                {dscr.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {dscr >= 1.25 ? (
              <Badge className="bg-green-100 text-green-800">✓ Meets DSCR requirement (≥1.25)</Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-800">⚠ Below DSCR requirement (&lt;1.25)</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showTaskDialog}
        onOpenChange={setShowTaskDialog}
        loanTitle={loan.title}
        onCreateTask={(taskData) => {
          if (onCreateTask) {
            onCreateTask(taskData)
          }
        }}
      />
    </div>
  )
}


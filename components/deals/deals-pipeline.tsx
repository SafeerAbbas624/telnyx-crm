"use client"

import React, { useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, DollarSign, Calendar, Trash2, Archive, Edit2, CheckCircle2 } from "lucide-react"
import { useDealsStore } from "@/useDealsStore"
import { formatCurrency } from "@/currency"
import { Deal } from "@/types/deals"
import NewPipelineDialog from "./new-pipeline-dialog"
import EditStagesDialog from "./edit-stages-dialog"
import NewDealDialog from "./new-deal-dialog"

export default function DealsPipeline() {
  const {
    deals,
    stages,
    pipelines,
    activePipelineId,
    activePipeline,
    setActivePipelineId,
    moveDeal,
    createDeal,
    updateDeal,
    deleteDeal,
    archiveDeal,
    addTaskToDeal,
    updateTask,
    deleteTask,
    createPipeline,
    updatePipeline,
    isLoading,
  } = useDealsStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null)
  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editValue, setEditValue] = useState("")
  const [showNewPipelineDialog, setShowNewPipelineDialog] = useState(false)
  const [showEditStagesDialog, setShowEditStagesDialog] = useState(false)
  const [showNewDealDialog, setShowNewDealDialog] = useState(false)

  // IMPORTANT: All hooks must be called before any conditional returns
  const filteredDeals = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return deals.filter(d =>
      d.title.toLowerCase().includes(q) || d.contactName.toLowerCase().includes(q)
    )
  }, [deals, searchQuery])

  const getDealsByStage = useCallback((stageId: string) => filteredDeals.filter(d => d.stage === stageId), [filteredDeals])
  const getTotalValueByStage = useCallback((stageId: string) => {
    const stageDealsList = filteredDeals.filter(d => d.stage === stageId)
    return stageDealsList.reduce((s, d) => s + (d.value || 0), 0)
  }, [filteredDeals])

  // Show loading state - AFTER all hooks
  if (isLoading && deals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading deals from database...</p>
        </div>
      </div>
    )
  }

  // Calculate statistics
  const totalDeals = filteredDeals.length
  const totalValue = filteredDeals.reduce((sum, d) => sum + (d.value || 0), 0)
  const weightedValue = filteredDeals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0)
  const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0

  const handleCreateDeal = (dealData: any) => {
    createDeal({
      ...dealData,
      tasks: [],
      assignedTo: "1",
      pipelineId: activePipelineId,
      archived: false,
    })
  }

  const handleEditDeal = (deal: Deal) => {
    setEditingDealId(deal.id)
    setEditTitle(deal.title)
    setEditValue(deal.value.toString())
  }

  const handleSaveEdit = (dealId: string) => {
    const value = parseInt(editValue.replace(/[^0-9]/g, ''), 10) || 0
    updateDeal(dealId, {
      title: editTitle,
      value,
    })
    setEditingDealId(null)
  }

  const handleDeleteDeal = (dealId: string) => {
    if (confirm("Are you sure you want to delete this deal?")) {
      deleteDeal(dealId)
    }
  }

  const handleArchiveDeal = (dealId: string) => {
    archiveDeal(dealId)
  }

  const handleToggleTask = (dealId: string, taskId: string, completed: boolean) => {
    updateTask(dealId, taskId, { completed: !completed })
  }

  const handleDeleteTask = (dealId: string, taskId: string) => {
    deleteTask(dealId, taskId)
  }

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDeal(dealId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDropOnStage = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    if (draggedDeal) {
      moveDeal(draggedDeal, stageId)
      setDraggedDeal(null)
    }
  }

  const handleCreatePipeline = (pipelineData: any) => {
    try {
      createPipeline({
        name: pipelineData.name,
        description: pipelineData.description,
        stages: [...stages], // Use current stages as template
        isDefault: false,
        isLoanPipeline: pipelineData.isLoanPipeline || false,
      })
    } catch (error) {
      console.error("Error creating pipeline:", error)
    }
  }

  const handleSaveStages = (updatedStages: any[]) => {
    try {
      if (!activePipeline || !updatedStages?.length) return

      // Determine removed stage IDs
      const prevStageIds = new Set((activePipeline.stages || []).map(s => s.id))
      const nextStageIds = new Set(updatedStages.map(s => s.id))
      const removedStageIds = Array.from(prevStageIds).filter(id => !nextStageIds.has(id))

      // Fallback to the first remaining stage in the updated list
      if (removedStageIds.length > 0) {
        const fallbackStageId = updatedStages[0]?.id
        if (fallbackStageId) {
          // Move deals from any removed stage to the fallback stage
          deals
            .filter(d => removedStageIds.includes(d.stage))
            .forEach(d => updateDeal(d.id, { stage: fallbackStageId }))
        }
      }

      // Update the active pipeline with new stages
      updatePipeline(activePipelineId, { stages: updatedStages })
    } catch (error) {
      console.error("Error updating stages:", error)
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deals Pipeline</h1>
            <p className="text-muted-foreground">Manage your deals and track progress</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={activePipelineId}
              onChange={(e) => setActivePipelineId(e.target.value)}
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button onClick={() => setShowNewDealDialog(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> New Deal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewPipelineDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Pipeline
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEditStagesDialog(true)}>
              Edit Stages
            </Button>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals or contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Deals</div>
              <div className="text-2xl font-bold text-blue-900">{totalDeals}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Value</div>
              <div className="text-2xl font-bold text-green-900">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Weighted Value</div>
              <div className="text-2xl font-bold text-purple-900">{formatCurrency(weightedValue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Avg Deal Size</div>
              <div className="text-2xl font-bold text-orange-900">{formatCurrency(avgDealSize)}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id)
            const totalValue = getTotalValueByStage(stage.id)
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnStage(e, stage.id)}
              >
                <Card className="h-full flex flex-col border-2 border-dashed border-transparent hover:border-primary/20 transition-colors">
                  <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{stage.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(totalValue)}</p>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-3">
                    <ScrollArea className="h-full">
                      <div className="space-y-3">
                        {stageDeals.map((deal) => {
                          const isEditing = editingDealId === deal.id
                          const nextIdx = stages.findIndex(s => s.id === deal.stage) + 1
                          const nextStage = stages[nextIdx]
                          return (
                            <Card
                              key={deal.id}
                              className="hover:shadow-md transition-all cursor-move bg-white border-l-4"
                              style={{ borderLeftColor: stage.color || '#e5e7eb' }}
                              draggable
                              onDragStart={(e) => handleDragStart(e, deal.id)}
                            >
                              <CardContent className="p-3 space-y-2">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Input
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      className="text-sm"
                                      placeholder="Deal title"
                                    />
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="text-sm"
                                      placeholder="Deal value"
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleSaveEdit(deal.id)} className="flex-1">Save</Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingDealId(null)} className="flex-1">Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="font-semibold text-sm leading-tight">{deal.title}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{deal.contactName}</div>
                                      </div>
                                      {deal.loanData && (
                                        <Badge className="bg-blue-100 text-blue-800 text-xs">Loan</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                      <DollarSign className="h-4 w-4 text-green-600" />
                                      <span className="font-bold text-green-600">{formatCurrency(deal.value)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{deal.expectedCloseDate || "TBD"}</span>
                                      </div>
                                      <Badge variant="outline">{deal.probability}%</Badge>
                                    </div>

                                    {/* Tasks */}
                                    {deal.tasks.length > 0 && (
                                      <div className="pt-2 border-t space-y-1">
                                        {deal.tasks.slice(0, 2).map(task => (
                                          <div key={task.id} className="flex items-center gap-2 text-xs">
                                            <CheckCircle2
                                              className={`h-3 w-3 cursor-pointer ${task.completed ? 'text-green-600' : 'text-gray-300'}`}
                                              onClick={() => handleToggleTask(deal.id, task.id, task.completed)}
                                            />
                                            <span className={task.completed ? 'line-through text-gray-400' : ''}>{task.title}</span>
                                          </div>
                                        ))}
                                        {deal.tasks.length > 2 && (
                                          <div className="text-xs text-muted-foreground">+{deal.tasks.length - 2} more</div>
                                        )}
                                      </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="pt-2 flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs flex-1"
                                        onClick={() => handleEditDeal(deal)}
                                      >
                                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs flex-1"
                                        onClick={() => handleArchiveDeal(deal.id)}
                                      >
                                        <Archive className="h-3 w-3 mr-1" /> Archive
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs flex-1 text-red-600 hover:text-red-700"
                                        onClick={() => handleDeleteDeal(deal.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                        <Button variant="ghost" className="w-full border-2 border-dashed" onClick={() => setShowNewDealDialog(true)}>
                          <Plus className="mr-2 h-4 w-4" /> Add Deal
                        </Button>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialogs */}
      <NewDealDialog
        open={showNewDealDialog}
        onOpenChange={setShowNewDealDialog}
        onCreateDeal={handleCreateDeal}
        stages={stages}
      />

      <NewPipelineDialog
        open={showNewPipelineDialog}
        onOpenChange={setShowNewPipelineDialog}
        onCreatePipeline={handleCreatePipeline}
      />

      <EditStagesDialog
        open={showEditStagesDialog}
        onOpenChange={setShowEditStagesDialog}
        stages={stages}
        onSaveStages={handleSaveStages}
      />
    </div>
  )
}

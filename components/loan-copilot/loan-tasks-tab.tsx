"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, Circle, Trash2, Calendar } from "lucide-react"
import { DealTask } from "@/types/deals"

interface LoanTasksTabProps {
  loanId: string
  tasks: DealTask[]
  onToggleTask?: (taskId: string, completed: boolean) => void
  onDeleteTask?: (taskId: string) => void
}

export default function LoanTasksTab({
  loanId,
  tasks,
  onToggleTask,
  onDeleteTask,
}: LoanTasksTabProps) {
  const completedTasks = tasks.filter(t => t.completed)
  const pendingTasks = tasks.filter(t => !t.completed)

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const isOverdue = (dateStr: string) => {
    try {
      const dueDate = new Date(dateStr)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return dueDate < today
    } catch {
      return false
    }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-lg mb-2">No Tasks</h3>
            <p className="text-sm text-muted-foreground">
              Create a task from the Details tab to get started.
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
                  Pending ({pendingTasks.length})
                </h3>
                <div className="space-y-2">
                  {pendingTasks.map((task) => (
                    <Card
                      key={task.id}
                      className={`cursor-pointer transition-colors ${
                        isOverdue(task.dueDate)
                          ? 'border-red-200 bg-red-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 mt-1"
                            onClick={() => onToggleTask?.(task.id, true)}
                          >
                            <Circle className="h-4 w-4 text-gray-400" />
                          </Button>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span
                                className={`text-xs ${
                                  isOverdue(task.dueDate)
                                    ? 'text-red-600 font-semibold'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {formatDate(task.dueDate)}
                              </span>
                              {isOverdue(task.dueDate) && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            onClick={() => onDeleteTask?.(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
                  Completed ({completedTasks.length})
                </h3>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <Card key={task.id} className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 mt-1"
                            onClick={() => onToggleTask?.(task.id, false)}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <div className="flex-1">
                            <p className="font-medium text-sm line-through text-gray-500">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(task.dueDate)}
                              </span>
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Done
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            onClick={() => onDeleteTask?.(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}


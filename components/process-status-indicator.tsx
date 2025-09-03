"use client"

import { useState } from "react"
import { useProcesses, type ActiveProcess } from "@/lib/context/process-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Headphones, Mail, MessageSquare, X, Play, Pause } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export default function ProcessStatusIndicator() {
  const { activeProcesses, pauseProcess, resumeProcess, removeProcess } = useProcesses()
  const [isOpen, setIsOpen] = useState(false)

  if (activeProcesses.length === 0) return null

  const getProcessIcon = (type: ActiveProcess["type"]) => {
    switch (type) {
      case "vapi":
        return <Headphones className="h-4 w-4" />
      case "email":
        return <Mail className="h-4 w-4" />
      case "text":
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getProcessColor = (type: ActiveProcess["type"]) => {
    switch (type) {
      case "vapi":
        return "bg-blue-500"
      case "email":
        return "bg-green-500"
      case "text":
        return "bg-purple-500"
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="fixed bottom-4 right-4 z-50 flex items-center gap-2" onClick={() => setIsOpen(true)}>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          {activeProcesses.length} Active Process{activeProcesses.length !== 1 ? "es" : ""}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Active Processes</SheetTitle>
          <SheetDescription>
            These processes will continue running even if you navigate to other sections.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {activeProcesses.map((process) => (
            <div key={process.id} className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-full ${getProcessColor(process.type)} text-white`}>
                    {getProcessIcon(process.type)}
                  </div>
                  <span className="font-medium">{process.label}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeProcess(process.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>
                  {process.progress} of {process.total} completed
                </span>
                <span>Started {formatDistanceToNow(process.startTime, { addSuffix: true })}</span>
              </div>
              <Progress value={(process.progress / process.total) * 100} className="h-2 mb-2" />
              <div className="flex justify-end gap-2">
                {process.isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => resumeProcess(process.id)}
                  >
                    <Play className="h-3 w-3" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => pauseProcess(process.id)}
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

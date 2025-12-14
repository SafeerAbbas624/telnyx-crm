'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Plus, CalendarIcon, Loader2 } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface QuickTaskPopoverProps {
  contactId: string
  contactName?: string
  className?: string
  iconClassName?: string
  variant?: 'ghost' | 'outline' | 'default'
  size?: 'sm' | 'default' | 'lg' | 'icon'
  onTaskCreated?: () => void
  children?: React.ReactNode
}

export function QuickTaskPopover({
  contactId,
  contactName,
  className,
  iconClassName = 'h-3.5 w-3.5 text-cyan-600',
  variant = 'ghost',
  size = 'sm',
  onTaskCreated,
  children
}: QuickTaskPopoverProps) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 1))
  const [loading, setLoading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCreate = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'task',
          taskType: 'Follow Up',
          subject: subject.trim(),
          description: '',
          priority: 'medium',
          status: 'planned',
          dueDate: dueDate.toISOString(),
          contactId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create task')
      }

      toast.success('Task created!', {
        description: `"${subject}" for ${contactName || 'contact'}`
      })
      
      // Reset and close
      setSubject('')
      setDueDate(addDays(new Date(), 1))
      setOpen(false)
      onTaskCreated?.()
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button
            size={size}
            variant={variant}
            className={cn('p-0', size === 'sm' && 'h-6 w-6', className)}
            title="Create quick task"
          >
            <Plus className={iconClassName} />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-3" 
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Quick Task {contactName && <span className="text-muted-foreground">for {contactName}</span>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quick-subject" className="text-xs">Subject</Label>
            <Input
              ref={inputRef}
              id="quick-subject"
              placeholder="e.g., Follow up call"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Due Date</Label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-8 text-sm font-normal"
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dueDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    if (date) setDueDate(date)
                    setShowCalendar(false)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button 
            onClick={handleCreate} 
            disabled={loading || !subject.trim()} 
            className="w-full h-8 text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Task'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}


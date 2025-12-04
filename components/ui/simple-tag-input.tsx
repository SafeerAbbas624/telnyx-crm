'use client'

import React, { useState, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimpleTagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  maxTags?: number
}

export function SimpleTagInput({
  value = [],
  onChange,
  placeholder = "Add tags...",
  className,
  maxTags
}: SimpleTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (tagName: string) => {
    const trimmedTag = tagName.trim()
    
    // Validate tag
    if (!trimmedTag) return
    if (value.includes(trimmedTag)) return // Prevent duplicates
    if (maxTags && value.length >= maxTags) return
    
    // Add tag and clear input
    onChange([...value, trimmedTag])
    setInputValue('')
    
    // Focus back on input
    inputRef.current?.focus()
  }

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      removeTag(value.length - 1)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const isMaxReached = maxTags && value.length >= maxTags

  return (
    <div className={cn("space-y-2", className)}>
      {/* Tag Bubbles */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 px-3 py-1.5 text-sm"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-1 hover:text-destructive transition-colors"
                aria-label={`Remove tag: ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input Field */}
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={isMaxReached ? `Maximum ${maxTags} tags reached` : placeholder}
        disabled={isMaxReached}
        className="cursor-text"
      />

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Press Enter to add a tag. Tags can contain spaces and special characters.
        {maxTags && ` (${value.length}/${maxTags})`}
      </p>
    </div>
  )
}


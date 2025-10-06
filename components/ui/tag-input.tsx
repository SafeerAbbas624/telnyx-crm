'use client'
// Version 2.0 - Simplified dropdown without Command component

import React, { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Plus, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tag {
  id: string
  name: string
  color: string
  description?: string
  is_system?: boolean
  usage_count?: number
}

interface TagSuggestion extends Tag {
  reason: string
  confidence: number
}

interface TagInputProps {
  value: Tag[]
  onChange: (tags: Tag[]) => void
  placeholder?: string
  className?: string
  contactId?: string
  showSuggestions?: boolean
  allowCreate?: boolean
  maxTags?: number
}

export function TagInput({
  value = [],
  onChange,
  placeholder = "Add tags...",
  className,
  contactId,
  showSuggestions = true,
  allowCreate = true,
  maxTags
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAvailableTags()
    if (contactId && showSuggestions) {
      loadSuggestions()
    }
  }, [contactId, showSuggestions])

  useEffect(() => {
    if (inputValue && isOpen) {
      searchTags(inputValue)
    }
  }, [inputValue, isOpen])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadAvailableTags = async () => {
    try {
      const response = await fetch('/api/contacts/tags')
      if (response.ok) {
        const tags = await response.json()
        setAvailableTags(tags)
      }
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const loadSuggestions = async () => {
    if (!contactId) return

    try {
      const response = await fetch(`/api/tags/suggestions?contactId=${contactId}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  const searchTags = async (query: string) => {
    if (!query.trim()) return

    try {
      setLoading(true)
      const response = await fetch(`/api/tags/suggestions?query=${encodeURIComponent(query)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        // Update available tags with search results
        const searchResults = data.suggestions.filter((tag: TagSuggestion) => 
          !value.some(selectedTag => selectedTag.id === tag.id)
        )
        setAvailableTags(prev => {
          const existing = prev.filter(tag => 
            tag.name.toLowerCase().includes(query.toLowerCase()) &&
            !value.some(selectedTag => selectedTag.id === tag.id)
          )
          return [...existing, ...searchResults.filter((result: Tag) => 
            !existing.some(tag => tag.id === result.id)
          )]
        })
      }
    } catch (error) {
      console.error('Failed to search tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTag = (tag: Tag) => {
    console.log('addTag called:', { tag, maxTags, currentLength: value.length })
    if (maxTags && value.length >= maxTags) {
      console.log('addTag: max tags reached')
      return
    }
    if (value.some(t => t.id === tag.id)) {
      console.log('addTag: tag already exists in value')
      return
    }

    console.log('addTag: adding tag to value')
    onChange([...value, tag])
    setInputValue('')
    setIsOpen(false)
  }

  const createTag = async (name: string) => {
    console.log('createTag called:', { name, allowCreate, trimmed: name.trim() })
    if (!allowCreate || !name.trim()) {
      console.log('createTag early return:', { allowCreate, trimmed: name.trim() })
      return
    }
    if (value.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      console.log('createTag: tag already exists')
      return
    }

    console.log('createTag: making API call')
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color: '#3B82F6' })
      })

      console.log('createTag API response:', { ok: response.ok, status: response.status })

      if (response.ok) {
        const newTag = await response.json()
        console.log('createTag: API success, adding tag:', newTag)
        addTag(newTag)
        loadAvailableTags() // Refresh available tags
      } else {
        const errorText = await response.text()
        console.log('createTag: API failed, creating temp tag:', errorText)
        // If API fails, create a temporary tag that will be handled by the parent component
        const tempTag: Tag = {
          id: `new:${name.trim()}`,
          name: name.trim(),
          color: '#3B82F6',
          description: 'New tag'
        }
        addTag(tempTag)
      }
    } catch (error) {
      console.error('createTag: Exception occurred:', error)
      // Fallback: create temporary tag
      const tempTag: Tag = {
        id: `new:${name.trim()}`,
        name: name.trim(),
        color: '#3B82F6',
        description: 'New tag'
      }
      console.log('createTag: Adding fallback temp tag:', tempTag)
      addTag(tempTag)
    }
  }

  const removeTag = (tagId: string) => {
    onChange(value.filter(tag => tag.id !== tagId))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('TagInput handleKeyDown:', { key: e.key, inputValue, allowCreate })
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      const existingTag = availableTags.find(tag =>
        tag.name.toLowerCase() === inputValue.toLowerCase()
      )

      console.log('Enter pressed:', { existingTag, inputValue, allowCreate })

      if (existingTag) {
        console.log('Adding existing tag:', existingTag)
        addTag(existingTag)
      } else if (allowCreate) {
        console.log('Creating new tag:', inputValue)
        createTag(inputValue)
      } else {
        console.log('Cannot create tag - allowCreate is false')
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1].id)
    }
  }

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !value.some(selectedTag => selectedTag.id === tag.id)
  )

  const canCreateNew = allowCreate && 
    inputValue.trim() && 
    !filteredTags.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) &&
    !value.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase())

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color, color: 'white' }}
              className="flex items-center gap-1 pr-1"
            >
              {tag.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-white/20"
                onClick={() => removeTag(tag.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            Suggested tags:
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions
              .filter(suggestion => !value.some(tag => tag.id === suggestion.id))
              .slice(0, 3)
              .map((suggestion) => (
                <Button
                  key={suggestion.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => addTag(suggestion)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {suggestion.name}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={maxTags && value.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder}
          disabled={maxTags && value.length >= maxTags}
          className="cursor-text"
        />
        {isOpen && (inputValue || filteredTags.length > 0) && (
          <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
            {loading && (
              <div className="p-2 text-sm text-muted-foreground">Loading...</div>
            )}

            {!loading && filteredTags.length === 0 && !canCreateNew && (
              <div className="p-2 text-sm text-muted-foreground text-center">No tags found.</div>
            )}

            {filteredTags.length > 0 && (
              <div className="p-1">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Available Tags</div>
                {filteredTags.slice(0, 8).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addTag(tag)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{ backgroundColor: tag.color, color: 'white' }}
                        className="text-xs"
                      >
                        {tag.name}
                      </Badge>
                      {tag.description && (
                        <span className="text-xs text-muted-foreground">
                          {tag.description}
                        </span>
                      )}
                    </div>
                    {tag.usage_count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {tag.usage_count} uses
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {canCreateNew && (
              <div className="p-1 border-t">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Create New</div>
                <button
                  onClick={() => createTag(inputValue)}
                  className="w-full flex items-center px-2 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create "{inputValue}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, CheckSquare, Target, Phone, Mail, Loader2, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'contact' | 'task' | 'deal';
  title: string;
  subtitle?: string;
  metadata?: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setSearchQuery('');
    setResults([]);

    // Navigate based on type
    if (result.type === 'contact') {
      router.push(`/contacts/${result.id}`);
    } else if (result.type === 'task') {
      router.push(`/tasks?taskId=${result.id}`);
    } else if (result.type === 'deal') {
      router.push(`/deals?dealId=${result.id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'contact':
        return <User className="h-4 w-4" />;
      case 'task':
        return <CheckSquare className="h-4 w-4" />;
      case 'deal':
        return <Target className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'contact':
        return 'bg-blue-500';
      case 'task':
        return 'bg-green-500';
      case 'deal':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="relative w-full">
      {/* Direct Input - Click and Start Typing */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search contacts, tasks, deals..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => {
            if (searchQuery.length >= 2) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            // Delay closing to allow clicking on results
            setTimeout(() => setOpen(false), 200);
          }}
          className="pl-9 pr-9 w-full"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent"
            onClick={() => {
              setSearchQuery('');
              setResults([]);
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results Dropdown */}
      {open && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-md shadow-lg z-[9999] max-h-[500px] overflow-hidden">
          <Command shouldFilter={false}>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              <CommandList className="max-h-[450px]">
                {['contact', 'task', 'deal'].map((type) => {
                  const typeResults = results.filter((r) => r.type === type);
                  if (typeResults.length === 0) return null;

                  // Get type label like Pipedrive
                  const typeLabel = type === 'contact' ? 'Person' : type === 'task' ? 'Task' : 'Deal';

                  return (
                    <CommandGroup key={type} heading={`${typeLabel}s (${typeResults.length})`}>
                      {typeResults.map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-3 cursor-pointer py-3 px-4 hover:bg-accent"
                        >
                          {/* Icon with background color */}
                          <div className={`p-2 rounded-md ${getTypeColor(result.type)} text-white flex-shrink-0`}>
                            {getIcon(result.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{result.title}</span>
                              {/* Type badge like Pipedrive */}
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 h-4 ${
                                  type === 'contact' ? 'bg-blue-100 text-blue-700' :
                                  type === 'task' ? 'bg-green-100 text-green-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {typeLabel}
                              </Badge>
                            </div>
                            {result.subtitle && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {result.subtitle}
                              </div>
                            )}
                          </div>

                          {/* Metadata on the right */}
                          {result.metadata && (
                            <div className="text-xs text-muted-foreground flex-shrink-0">
                              {result.metadata}
                            </div>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            )}
          </Command>
        </div>
      )}
    </div>
  );
}


'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Variable, ChevronDown } from 'lucide-react';
import {
  TEMPLATE_VARIABLES as CENTRAL_VARIABLES,
  formatVariableForInsertion
} from '@/lib/templates/variables';

// Re-export for backward compatibility - maps to new central config format
export const TEMPLATE_VARIABLES = {
  contact: CENTRAL_VARIABLES.filter(v => v.category === 'Contact').map(v => ({
    name: v.name,
    description: v.description,
  })),
  property: CENTRAL_VARIABLES.filter(v => v.category === 'Property').map(v => ({
    name: v.name,
    description: v.description,
  })),
  loan: CENTRAL_VARIABLES.filter(v => v.category === 'Loan').map(v => ({
    name: v.name,
    description: v.description,
  })),
  system: CENTRAL_VARIABLES.filter(v => v.category === 'System').map(v => ({
    name: v.name,
    description: v.description,
  })),
};

interface TemplateVariableSelectorProps {
  onSelect: (variable: string) => void;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function TemplateVariableSelector({
  onSelect,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className = '',
}: TemplateVariableSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside handler
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };

    // Use capture phase to get events before dialog intercepts them
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  // Use central config directly, grouped by category
  const allVariables = CENTRAL_VARIABLES.map(v => ({
    name: v.name,
    description: v.description,
    category: v.category,
  }));

  const filteredVariables = search
    ? allVariables.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.description.toLowerCase().includes(search.toLowerCase()) ||
        v.category.toLowerCase().includes(search.toLowerCase())
      )
    : allVariables;

  const handleSelect = (variableName: string) => {
    onSelect(formatVariableForInsertion(variableName));
    setOpen(false);
    setSearch('');
  };

  // Group by category for display
  const groupedVariables = filteredVariables.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, typeof allVariables>);

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant={buttonVariant}
        size={buttonSize}
        className={`gap-1 ${className}`}
        type="button"
        onClick={() => setOpen(!open)}
      >
        <Variable className="h-4 w-4" />
        Insert Variable
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 w-80 rounded-md border bg-popover text-popover-foreground shadow-lg z-[99999] animate-in fade-in-0 zoom-in-95"
          style={{ position: 'absolute' }}
        >
          <div className="p-2 border-b bg-popover">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Search variables..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setSearch('');
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto overscroll-contain">
            {Object.entries(groupedVariables).length > 0 ? (
              Object.entries(groupedVariables).map(([category, variables]) => (
                <div key={category} className="p-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {category}
                  </div>
                  <div className="space-y-0.5">
                    {variables.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => handleSelect(v.name)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent text-left transition-colors cursor-pointer"
                      >
                        <Badge variant="secondary" className="font-mono text-xs">
                          {`{${v.name}}`}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate ml-2 max-w-[160px]">
                          {v.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No variables found matching &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


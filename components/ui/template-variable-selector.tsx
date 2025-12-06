'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          className={`gap-1 ${className}`}
          type="button"
        >
          <Variable className="h-4 w-4" />
          Insert Variable
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search variables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {Object.entries(groupedVariables).map(([category, variables]) => (
            <div key={category} className="p-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                {category}
              </div>
              <div className="space-y-1">
                {variables.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(v.name);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs pointer-events-none">
                        {`{${v.name}}`}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground truncate ml-2 pointer-events-none">
                      {v.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredVariables.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No variables found matching "{search}"
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}


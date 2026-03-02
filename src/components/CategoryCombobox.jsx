import React, { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { CATEGORIES, UNCATEGORIZED } from "@/lib/categories";

const ALL_CATEGORIES = [...CATEGORIES, UNCATEGORIZED];

export function CategoryCombobox({ value = '', onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSelect = useCallback((cat) => {
    onChange(cat === value ? '' : cat);
    setOpen(false);
    setSearch('');
  }, [value, onChange]);

  const filtered = search
    ? ALL_CATEGORIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : ALL_CATEGORIES;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between font-normal bg-background text-foreground border-border hover:bg-background ${className}`}
        >
          <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
            {value || 'Select a category'}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search category…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>
              <div className="px-3 py-2 text-sm text-muted-foreground">No category found.</div>
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(cat => (
                <CommandItem
                  key={cat}
                  value={cat}
                  onSelect={() => handleSelect(cat)}
                >
                  <span className={value === cat ? 'font-semibold text-primary' : ''}>{cat}</span>
                  {value === cat && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

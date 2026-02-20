/**
 * FacebookCategoryPicker
 *
 * Two-level category selector fed from the scraped FACEBOOK_CATEGORIES data.
 * Shows a searchable top-level category selector and, once selected, a
 * searchable subcategory selector.
 *
 * Props:
 *   value        – current selected value (categoryId slug string)
 *   displayValue – current display path ("Apparel > Shoes")
 *   onChange     – (categoryId, categoryPath) => void
 */

import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FACEBOOK_CATEGORIES } from '@/data/facebookCategories';

export default function FacebookCategoryPicker({ value, displayValue, onChange }) {
  const [parentOpen, setParentOpen]   = useState(false);
  const [childOpen,  setChildOpen]    = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [childSearch,  setChildSearch]  = useState('');

  // Derive which top-level category is currently selected
  const selectedParent = useMemo(() => {
    if (!value) return null;
    for (const cat of FACEBOOK_CATEGORIES) {
      if (cat.categoryId === value) return cat;
      if (cat.subcategories?.some(s => s.categoryId === value)) return cat;
    }
    return null;
  }, [value]);

  const selectedSub = useMemo(() => {
    if (!value || !selectedParent) return null;
    return selectedParent.subcategories?.find(s => s.categoryId === value) ?? null;
  }, [value, selectedParent]);

  const filteredParents = useMemo(() => {
    const q = parentSearch.toLowerCase().trim();
    if (!q) return FACEBOOK_CATEGORIES;
    return FACEBOOK_CATEGORIES.filter(c =>
      c.categoryName.toLowerCase().includes(q)
    );
  }, [parentSearch]);

  const filteredChildren = useMemo(() => {
    if (!selectedParent?.subcategories) return [];
    const q = childSearch.toLowerCase().trim();
    if (!q) return selectedParent.subcategories;
    return selectedParent.subcategories.filter(c =>
      c.categoryName.toLowerCase().includes(q)
    );
  }, [selectedParent, childSearch]);

  function selectParent(cat) {
    setParentOpen(false);
    setParentSearch('');
    setChildSearch('');
    if (!cat.subcategories?.length) {
      // Leaf at top level
      onChange(cat.categoryId, cat.categoryName);
    } else {
      // Select the parent but require a subcategory
      onChange(cat.categoryId, cat.categoryName);
    }
  }

  function selectChild(parent, sub) {
    setChildOpen(false);
    setChildSearch('');
    onChange(sub.categoryId, `${parent.categoryName} > ${sub.categoryName}`);
  }

  function clear() {
    onChange('', '');
    setParentSearch('');
    setChildSearch('');
  }

  return (
    <div className="space-y-2">
      {/* Selected path badge */}
      {displayValue && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs max-w-full whitespace-normal break-words">
            {displayValue}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            className="h-6 px-2 text-xs shrink-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Step 1 – top-level category */}
      <div>
        <Label className="text-xs mb-1 block text-muted-foreground">Category</Label>
        <Popover open={parentOpen} onOpenChange={setParentOpen} modal>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              <span className="truncate">
                {selectedParent ? selectedParent.categoryName : 'Select a category…'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search categories…"
                value={parentSearch}
                onValueChange={setParentSearch}
              />
              <CommandList>
                {filteredParents.length === 0 && (
                  <CommandEmpty>No category found.</CommandEmpty>
                )}
                <CommandGroup>
                  {filteredParents.map(cat => (
                    <CommandItem
                      key={cat.categoryId}
                      value={cat.categoryId}
                      onSelect={() => selectParent(cat)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedParent?.categoryId === cat.categoryId
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {cat.categoryName}
                      {cat.subcategories?.length > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {cat.subcategories.length} sub
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Step 2 – subcategory (only when parent has children) */}
      {selectedParent?.subcategories?.length > 0 && (
        <div>
          <Label className="text-xs mb-1 block text-muted-foreground">Subcategory</Label>
          <Popover open={childOpen} onOpenChange={setChildOpen} modal>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                <span className="truncate">
                  {selectedSub ? selectedSub.categoryName : 'Select a subcategory…'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search subcategories…"
                  value={childSearch}
                  onValueChange={setChildSearch}
                />
                <CommandList>
                  {filteredChildren.length === 0 && (
                    <CommandEmpty>No subcategory found.</CommandEmpty>
                  )}
                  <CommandGroup>
                    {filteredChildren.map(sub => (
                      <CommandItem
                        key={sub.categoryId}
                        value={sub.categoryId}
                        onSelect={() => selectChild(selectedParent, sub)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedSub?.categoryId === sub.categoryId
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        {sub.categoryName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

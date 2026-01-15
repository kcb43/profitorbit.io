import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TagInput component for managing tags
 * Allows adding tags by pressing Enter or comma
 * Tags are displayed as removable badges
 * 
 * @param {string} value - Comma-separated string of tags
 * @param {Function} onChange - Callback with comma-separated string of tags
 */
export function TagInput({ 
  value = "", 
  onChange, 
  placeholder = "Type a tag and press Enter or comma",
  className,
  disabled = false,
  ...props 
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  // Convert string value to array of tags
  const tags = value 
    ? value.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  const handleInputKeyDown = (e) => {
    // Commit only on Enter or comma (multi-word tags stay intact until committed).
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTagFromInput();
    }
    // Handle Backspace to remove last tag if input is empty
    else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const addTagFromInput = () => {
    if (!inputValue.trim()) return;
    
    // If the input contains commas, treat them as separators. Otherwise, treat the whole input as one tag.
    const partsToAdd = inputValue.includes(',')
      ? inputValue.split(',').map((p) => p.trim()).filter(Boolean)
      : [inputValue.trim()];
    
    // Add all new tags that don't already exist
    const existingTags = new Set(tags.map(t => t.toLowerCase()));
    const newTags = [...tags];
    
    partsToAdd.forEach(part => {
      const trimmed = part.trim();
      if (trimmed && !existingTags.has(trimmed.toLowerCase())) {
        newTags.push(trimmed);
        existingTags.add(trimmed.toLowerCase());
      }
    });
    
    // Update parent with comma-separated string
    onChange(newTags.join(', '));
    setInputValue("");
  };

  const removeTag = (tagToRemove) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    // Update parent with comma-separated string
    onChange(newTags.join(', '));
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border border-input rounded-md bg-transparent shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring">
        {/* Display existing tags */}
        {tags.map((tag, index) => (
          <Badge 
            key={`${tag}-${index}`} 
            variant="secondary" 
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-muted/50 text-foreground border border-border/60"
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/20 focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={`Remove ${tag} tag`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        
        {/* Input field for adding new tags */}
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-[120px] border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
          {...props}
        />
      </div>
      {tags.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {tags.length} {tags.length === 1 ? 'tag' : 'tags'}. Press Enter or comma to add more. Click × to remove.
        </p>
      )}
    </div>
  );
}


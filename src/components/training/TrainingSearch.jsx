import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchGuides } from '@/lib/training';

export default function TrainingSearch({ className, onSearch, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    if (onSearch) onSearch(val);

    if (val.trim().length >= 2) {
      const found = searchGuides(val).slice(0, 6);
      setResults(found);
      setIsOpen(found.length > 0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onSearch) onSearch('');
    inputRef.current?.focus();
  }

  function handleSelect(slug) {
    setIsOpen(false);
    navigate(`/training/${slug}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search guides…"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {results.map((guide) => (
            <button
              key={guide.slug}
              onClick={() => handleSelect(guide.slug)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{guide.title}</div>
                <div className="text-xs text-muted-foreground truncate">{guide.category}</div>
              </div>
              {guide.estimatedTime && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {guide.estimatedTime}m
                </span>
              )}
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

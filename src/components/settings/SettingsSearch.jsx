import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchSections } from '@/modules/settingsRegistry';
import SettingsTile from './SettingsTile';

/**
 * Live search bar that filters settings tiles.
 * When query is empty, children are rendered (the full grouped layout).
 * When query is non-empty, the matching tiles are shown instead.
 */
export default function SettingsSearch({ children }) {
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchSections(query) : null;

  // Sync ?search= URL param on mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('search') || '';
    if (q) setQuery(q);
  }, []);

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings…"
          className="pl-9 pr-9 h-10 bg-muted/40 border-border focus-visible:ring-1"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results vs. normal layout */}
      {results ? (
        results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No settings found for &ldquo;{query}&rdquo;
          </p>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map((s) => (
                <SettingsTile key={s.id} section={s} />
              ))}
            </div>
          </div>
        )
      ) : (
        children
      )}
    </div>
  );
}

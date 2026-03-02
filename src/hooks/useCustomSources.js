import { useState, useCallback } from "react";
import { ALL_SOURCES, ALL_PLATFORMS } from "@/constants/marketplaces";

// Custom sources that should be removed (not valid sources/platforms)
const BLOCKED_CUSTOM = ["crosslist"];

// Build a set of predefined names for quick lookup
const PREDEFINED_SOURCE_NAMES = new Set(ALL_SOURCES.map(s => s.name.toLowerCase()));
const PREDEFINED_PLATFORM_NAMES = new Set(ALL_PLATFORMS.map(p => p.label.toLowerCase()));

function cleanCustomList(list, storageKey) {
  const isPlatformKey = storageKey.includes("platform");
  const predefined = isPlatformKey ? PREDEFINED_PLATFORM_NAMES : PREDEFINED_SOURCE_NAMES;

  const cleaned = list.filter(name => {
    const lower = name.toLowerCase().trim();
    // Remove blocked entries
    if (BLOCKED_CUSTOM.includes(lower)) return false;
    // Remove entries that now exist as predefined
    if (predefined.has(lower)) return false;
    return true;
  });

  return cleaned;
}

/**
 * Manages a list of custom source/platform names persisted in localStorage.
 * Automatically removes blocked entries (e.g., "Crosslist") and entries that
 * have been promoted to predefined sources (e.g., "Micro Center").
 * @param {string} storageKey - localStorage key to use
 * @returns {{ customSources: string[], addCustomSource: fn, removeCustomSource: fn }}
 */
export function useCustomSources(storageKey) {
  const [customSources, setCustomSources] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      const cleaned = cleanCustomList(parsed, storageKey);
      // Persist cleanup if anything was removed
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(storageKey, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  const addCustomSource = useCallback((name) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    // Don't allow adding blocked names
    if (BLOCKED_CUSTOM.includes(trimmed.toLowerCase())) return;
    setCustomSources(prev => {
      if (prev.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev, trimmed];
      try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  }, [storageKey]);

  const removeCustomSource = useCallback((name) => {
    setCustomSources(prev => {
      const updated = prev.filter(s => s !== name);
      try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  }, [storageKey]);

  return { customSources, addCustomSource, removeCustomSource };
}

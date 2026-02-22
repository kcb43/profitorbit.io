import { useState, useCallback } from "react";

/**
 * Manages a list of custom source/platform names persisted in localStorage.
 * @param {string} storageKey - localStorage key to use
 * @returns {{ customSources: string[], addCustomSource: fn, removeCustomSource: fn }}
 */
export function useCustomSources(storageKey) {
  const [customSources, setCustomSources] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addCustomSource = useCallback((name) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
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

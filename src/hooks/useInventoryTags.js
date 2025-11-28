import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "inventory-tag-preferences";

const readStorage = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch (error) {
    console.warn("Failed to parse inventory tag storage", error);
    return {};
  }
};

export function useInventoryTags() {
  const [state, setState] = useState(() => readStorage());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to persist inventory tag storage", error);
    }
  }, [state]);

  const ensureEntry = useCallback(
    (itemId) => {
      const existing = state[itemId];
      if (existing) return existing;
      return { favorite: false, tags: [] };
    },
    [state]
  );

  const toggleFavorite = useCallback((itemId) => {
    setState((prev) => {
      const existing = prev[itemId] || { favorite: false, tags: [] };
      const nextFav = !existing.favorite;
      const nextEntry = { ...existing, favorite: nextFav };
      const nextState = { ...prev, [itemId]: nextEntry };
      if (!nextFav && nextEntry.tags.length === 0) {
        delete nextState[itemId];
      }
      return nextState;
    });
  }, []);

  const addTag = useCallback((itemId, tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setState((prev) => {
      const entry = ensureEntry(itemId);
      const existingTags = entry.tags || [];
      if (existingTags.some((existingTag) => existingTag.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const nextEntry = {
        ...entry,
        tags: [...existingTags, trimmed],
      };
      return {
        ...prev,
        [itemId]: nextEntry,
      };
    });
  }, [ensureEntry]);

  const removeTag = useCallback((itemId, tag) => {
    setState((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;
      const nextTags = entry.tags.filter((existingTag) => existingTag !== tag);
      const nextEntry = { ...entry, tags: nextTags };
      const nextState = { ...prev, [itemId]: nextEntry };
      if (!nextEntry.favorite && nextTags.length === 0) {
        delete nextState[itemId];
      }
      return nextState;
    });
  }, []);

  const clearTags = useCallback((itemId) => {
    setState((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;
      const nextEntry = { ...entry, tags: [] };
      const nextState = { ...prev, [itemId]: nextEntry };
      if (!nextEntry.favorite) {
        delete nextState[itemId];
      }
      return nextState;
    });
  }, []);

  const isFavorite = useCallback(
    (itemId) => Boolean(state[itemId]?.favorite),
    [state]
  );

  const getTags = useCallback(
    (itemId) => state[itemId]?.tags || [],
    [state]
  );

  const clearRemovedItems = useCallback((validIds) => {
    setState((prev) => {
      const next = {};
      validIds.forEach((id) => {
        if (prev[id]) {
          next[id] = prev[id];
        }
      });
      return next;
    });
  }, []);

  return {
    tagState: state,
    toggleFavorite,
    addTag,
    removeTag,
    clearTags,
    isFavorite,
    getTags,
    clearRemovedItems,
  };
}





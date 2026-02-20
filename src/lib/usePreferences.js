/**
 * usePreferences – read/write user_preferences in a single global cache.
 *
 * Usage:
 *   const { prefs, updatePrefs, loading } = usePreferences();
 *
 *   // read
 *   const theme = prefs.appearance?.theme ?? 'default-light';
 *
 *   // write (deep-merged server-side)
 *   await updatePrefs({ appearance: { theme: 'default-dark' } });
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';

// ─── Module-level cache so all hook instances share one fetch ─────────────────

let _cache = null;          // null = not loaded, {} = loaded but empty
let _inflight = null;       // in-flight fetch promise
const _listeners = new Set();

function _notify(prefs) {
  _cache = prefs;
  _listeners.forEach((fn) => fn(prefs));
}

async function _getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'x-user-id': session.user.id,
  };
}

async function _load() {
  if (_cache !== null) return _cache;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const headers = await _getHeaders();
      if (!headers) return {};
      const res = await fetch('/api/preferences', { headers });
      const data = res.ok ? await res.json() : {};
      const prefs = data?.preferences ?? {};
      _notify(prefs);
      return prefs;
    } catch {
      return _cache ?? {};
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

function _deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = _deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePreferences() {
  const [prefs, setPrefs]   = useState(_cache ?? {});
  const [loading, setLoading] = useState(_cache === null);

  useEffect(() => {
    _listeners.add(setPrefs);

    if (_cache === null) {
      setLoading(true);
      _load().then((p) => {
        setPrefs(p);
        setLoading(false);
      });
    }

    return () => {
      _listeners.delete(setPrefs);
    };
  }, []);

  /**
   * Deep-merge `patch` into preferences (optimistic + server sync).
   * @param {Record<string,any>} patch
   */
  const updatePrefs = useCallback(
    async (patch) => {
      const optimistic = _deepMerge(_cache ?? {}, patch);
      _notify(optimistic);

      try {
        const headers = await _getHeaders();
        if (!headers) return;
        await fetch('/api/preferences', {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch }),
        });
      } catch (err) {
        console.error('[usePreferences] update failed:', err);
      }
    },
    [],
  );

  /** Invalidate and refetch preferences. */
  const refetch = useCallback(async () => {
    _cache = null;
    setLoading(true);
    const p = await _load();
    setPrefs(p);
    setLoading(false);
  }, []);

  return { prefs, updatePrefs, refetch, loading };
}

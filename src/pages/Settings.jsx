/**
 * Settings Control Panel – Windows-style hub.
 *
 * Renders tiles grouped by category.
 * Each tile routes to its section page at /Settings/<id>.
 * Includes a live search bar that filters tiles by title, description, and keywords.
 * Also shows an extension install/status banner at the top.
 */

import React, { useState, useEffect } from 'react';
import { Puzzle, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSectionsByCategory } from '@/modules/settingsRegistry';
import SettingsTile from '@/components/settings/SettingsTile';
import SettingsSearch from '@/components/settings/SettingsSearch';

// ── Extension status banner ───────────────────────────────────────────────────

function ExtensionBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'installed' | 'not-installed'
  const [version, setVersion] = useState(null);

  useEffect(() => {
    const check = () => {
      try {
        const ext = window?.ProfitOrbitExtension;
        const installed =
          typeof ext?.isAvailable === 'function' ? !!ext.isAvailable() : !!ext;

        if (installed) {
          setStatus('installed');
          // Try common version exposure patterns
          const ver =
            ext?.version ??
            ext?.getVersion?.() ??
            window?.__PROFIT_ORBIT_EXTENSION_VERSION ??
            null;
          if (ver) setVersion(String(ver));
        } else {
          setStatus('not-installed');
        }
      } catch {
        setStatus('not-installed');
      }
    };

    // Give the bridge 600 ms to initialise before first check
    const t = setTimeout(check, 600);
    return () => clearTimeout(t);
  }, []);

  const isInstalled = status === 'installed';
  const isChecking  = status === 'checking';

  return (
    <div
      className={cn(
        'relative rounded-2xl border overflow-hidden',
        'bg-gradient-to-br from-indigo-500/5 via-background to-violet-500/5',
        isInstalled
          ? 'border-green-200 dark:border-green-900/60'
          : 'border-indigo-200 dark:border-indigo-900/60',
      )}
    >
      {/* Decorative background orb */}
      <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full bg-indigo-500/8 blur-2xl" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
            'bg-gradient-to-br from-indigo-500 to-violet-600',
          )}
        >
          <Puzzle className="w-6 h-6 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Orben Browser Extension
            </h2>

            {/* Status badge */}
            {!isChecking && (
              isInstalled ? (
                <Badge
                  variant="outline"
                  className="gap-1 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 text-[11px] py-0"
                >
                  <Check className="w-3 h-3" />
                  Installed{version ? ` · v${version}` : ''}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-[11px] py-0"
                >
                  Not installed
                </Badge>
              )
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {isInstalled
              ? 'The extension is active and ready. It enables marketplace connections, cross-listing, and live status syncing.'
              : (
                <>
                  Extension not detected. Open{' '}
                  <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono select-all">
                    chrome://extensions
                  </code>
                  , enable <strong>Developer mode</strong>, and load the Orben extension folder. Then refresh this page.
                </>
              )}
          </p>
        </div>

        {/* Not-installed action hint */}
        {!isChecking && !isInstalled && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Action required
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const categories = getSectionsByCategory();

export default function Settings() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Manage your account, preferences, and integrations.
        </p>
      </div>

      {/* Extension install / status banner */}
      <ExtensionBanner />

      {/* Search + grouped tiles */}
      <SettingsSearch>
        {categories.map(({ category, sections }) => (
          <div key={category} className="space-y-3">
            {/* Category label */}
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category}
            </h2>

            {/* Tile grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sections.map((s) => (
                <SettingsTile key={s.id} section={s} />
              ))}
            </div>
          </div>
        ))}
      </SettingsSearch>
    </div>
  );
}

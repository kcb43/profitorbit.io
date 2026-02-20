/**
 * Settings Control Panel – Windows-style hub.
 *
 * Renders tiles grouped by category.
 * Each tile routes to its section page at /Settings/<id>.
 * Includes a live search bar that filters tiles by title, description, and keywords.
 */

import React from 'react';
import { getSectionsByCategory } from '@/modules/settingsRegistry';
import SettingsTile from '@/components/settings/SettingsTile';
import SettingsSearch from '@/components/settings/SettingsSearch';

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

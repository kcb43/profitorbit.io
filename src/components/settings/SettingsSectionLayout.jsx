import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Consistent shell for every settings section page.
 *
 * Usage:
 *   <SettingsSectionLayout section={sectionMeta}>
 *     <YourSettingsContent />
 *   </SettingsSectionLayout>
 */
export default function SettingsSectionLayout({ section, children }) {
  const Icon = section?.icon;
  const gradient = section?.gradient ?? 'from-gray-500 to-gray-600';

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          to="/Settings"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </Link>
        <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
        <span className="text-foreground font-medium">{section?.title}</span>
      </nav>

      {/* Section header */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-gradient-to-br shadow-md',
            gradient,
          )}
        >
          {Icon && <Icon className="w-6 h-6 text-white" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{section?.title}</h1>
          {section?.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* Content */}
      <div className="space-y-6">{children}</div>

      {/* Back link */}
      <div className="pt-2">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground">
          <Link to="/Settings">← Back to Settings</Link>
        </Button>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Windows-style settings tile.
 * Accepts a registry section object (id, title, description, icon, route, gradient, color).
 */
export default function SettingsTile({ section, disabled = false }) {
  const navigate = useNavigate();
  const Icon = section.icon;

  const colorRing = {
    blue:    'group-hover:ring-blue-500/30',
    red:     'group-hover:ring-red-500/30',
    violet:  'group-hover:ring-violet-500/30',
    purple:  'group-hover:ring-purple-500/30',
    amber:   'group-hover:ring-amber-500/30',
    emerald: 'group-hover:ring-emerald-500/30',
  }[section.color] ?? 'group-hover:ring-primary/30';

  const handleClick = () => {
    if (!disabled) navigate(section.route);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'group relative flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left',
        'transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-transparent',
        `ring-1 ring-transparent ${colorRing}`,
        disabled && 'opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
          'bg-gradient-to-br shadow-sm',
          section.gradient ?? 'from-gray-500 to-gray-600',
        )}
      >
        {Icon && <Icon className="w-5 h-5 text-white" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-foreground leading-tight">{section.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
          {section.description}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight
        className={cn(
          'flex-shrink-0 w-4 h-4 mt-1 text-muted-foreground/40 transition-transform duration-200',
          'group-hover:translate-x-0.5 group-hover:text-muted-foreground',
        )}
      />
    </button>
  );
}

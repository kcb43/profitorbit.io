import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Sparkles, Wrench, Shield, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META } from '@/lib/training';

const ICON_MAP = {
  Rocket,
  Sparkles,
  Wrench,
  Shield,
  BookOpen,
};

const COLOR_CLASSES = {
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    border: 'hover:border-emerald-500/40',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    border: 'hover:border-violet-500/40',
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'hover:border-amber-500/40',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  blue: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    border: 'hover:border-blue-500/40',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
};

export default function CategoryCard({ category, guideCount, className }) {
  const meta = CATEGORY_META[category] || { icon: 'BookOpen', description: '', color: 'blue' };
  const Icon = ICON_MAP[meta.icon] || BookOpen;
  const colors = COLOR_CLASSES[meta.color] || COLOR_CLASSES.blue;

  // URL-encode the category for the query string
  const href = `/training?category=${encodeURIComponent(category)}`;

  return (
    <Link
      to={href}
      className={cn(
        'group flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        colors.border,
        className
      )}
    >
      <div className={cn('flex-shrink-0 rounded-lg p-2.5', colors.icon)}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{category}</h3>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{meta.description}</p>
        {guideCount != null && (
          <span className={cn('inline-block mt-2 text-xs font-medium rounded px-2 py-0.5', colors.badge)}>
            {guideCount} {guideCount === 1 ? 'guide' : 'guides'}
          </span>
        )}
      </div>
    </Link>
  );
}

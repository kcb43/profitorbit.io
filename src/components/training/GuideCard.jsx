import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, Star, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DIFFICULTY_COLORS = {
  beginner: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  intermediate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  advanced: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

export default function GuideCard({ guide, compact = false, className }) {
  if (!guide) return null;

  return (
    <Link
      to={`/training/${guide.slug}`}
      className={cn(
        'group block rounded-xl border border-border bg-card p-4 transition-all duration-200',
        'hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {guide.isNew && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded px-1.5 py-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                New
              </span>
            )}
            {guide.isFeatured && !guide.isNew && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded px-1.5 py-0.5">
                <Star className="w-2.5 h-2.5" />
                Featured
              </span>
            )}
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5',
                DIFFICULTY_COLORS[guide.difficulty] || DIFFICULTY_COLORS.beginner
              )}
            >
              {guide.difficulty}
            </span>
          </div>

          <h3 className={cn('font-semibold text-foreground leading-snug group-hover:text-primary transition-colors', compact ? 'text-sm' : 'text-base')}>
            {guide.title}
          </h3>

          {!compact && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {guide.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {guide.estimatedTime && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {guide.estimatedTime} min
              </span>
            )}
            <span className="text-xs text-muted-foreground/60">{guide.category}</span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </Link>
  );
}

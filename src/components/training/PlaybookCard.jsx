import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, CheckCircle2, Circle, Loader2, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlaybookCard({ playbook, progress, className }) {
  if (!playbook) return null;

  const totalSteps = playbook.steps?.length || 0;
  const completedCount = progress?.completed_step_ids?.length || 0;
  const percent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isCompleted = percent === 100;
  const isInProgress = completedCount > 0 && !isCompleted;

  return (
    <Link
      to={`/training/playbooks/${playbook.slug}`}
      className={cn(
        'group block rounded-xl border border-border bg-card p-5 transition-all duration-200',
        'hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-2">
            {isCompleted ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full px-2.5 py-0.5">
                <CheckCircle2 className="w-3 h-3" />
                Completed
              </span>
            ) : isInProgress ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                <Loader2 className="w-3 h-3" />
                In progress
              </span>
            ) : playbook.isFeatured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full px-2.5 py-0.5">
                <Flame className="w-3 h-3" />
                Popular
              </span>
            ) : null}
          </div>

          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
            {playbook.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{playbook.description}</p>

          <div className="flex items-center gap-3 mt-3">
            {playbook.estimatedTotalTime && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {playbook.estimatedTotalTime} min total
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {totalSteps} steps
            </span>
          </div>

          {/* Progress bar (only when started) */}
          {completedCount > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{totalSteps} steps done
                </span>
                <span className="text-xs font-medium text-primary">{percent}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isCompleted ? 'bg-emerald-500' : 'bg-primary'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </Link>
  );
}

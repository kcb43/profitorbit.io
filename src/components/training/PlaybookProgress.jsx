import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, Clock, ExternalLink, BookOpen, Play, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase';

export default function PlaybookProgress({ playbook, initialProgress, onProgressChange }) {
  const [completedIds, setCompletedIds] = useState(
    initialProgress?.completed_step_ids || []
  );
  const [saving, setSaving] = useState(false);

  const totalSteps = playbook.steps?.length || 0;
  const completedCount = completedIds.length;
  const percent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isCompleted = percent === 100;

  const nextIncompleteStep = playbook.steps?.find((s) => !completedIds.includes(s.id));

  async function toggleStep(stepId) {
    const isNowComplete = !completedIds.includes(stepId);
    const next = isNowComplete
      ? [...completedIds, stepId]
      : completedIds.filter((id) => id !== stepId);

    setCompletedIds(next);
    if (onProgressChange) onProgressChange(next);

    // Persist to DB
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/training/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          playbookSlug: playbook.slug,
          completedStepIds: next,
          totalSteps,
        }),
      });
    } catch {
      // Fail silently
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <Trophy className="w-5 h-5 text-amber-500" />
              ) : (
                <Play className="w-5 h-5 text-primary" />
              )}
              <span className="font-semibold text-foreground">
                {isCompleted ? 'Playbook complete!' : `${completedCount} of ${totalSteps} steps done`}
              </span>
            </div>
            {!isCompleted && nextIncompleteStep && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Next: {nextIncompleteStep.title}
              </p>
            )}
          </div>
          <span className={cn('text-2xl font-bold', isCompleted ? 'text-amber-500' : 'text-primary')}>
            {percent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', isCompleted ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${percent}%` }}
          />
        </div>

        {!isCompleted && nextIncompleteStep && (
          <Button
            size="sm"
            className="mt-4"
            onClick={() => {
              const el = document.getElementById(`step-${nextIncompleteStep.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>

      {/* Steps list */}
      <div className="space-y-3">
        {playbook.steps?.map((step, i) => {
          const isStepDone = completedIds.includes(step.id);
          return (
            <div
              key={step.id}
              id={`step-${step.id}`}
              className={cn(
                'rounded-xl border p-5 transition-all duration-200',
                isStepDone
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border bg-card'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Step number / check */}
                <button
                  onClick={() => toggleStep(step.id)}
                  className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
                  aria-label={isStepDone ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isStepDone ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground/40 hover:text-primary" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Step {i + 1}
                    </span>
                    {step.estimatedTime && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {step.estimatedTime} min
                      </span>
                    )}
                  </div>

                  <h3 className={cn('font-semibold leading-snug', isStepDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>

                  {/* CTAs */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {step.guideSlug && (
                      <Link
                        to={`/training/${step.guideSlug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        View Guide
                      </Link>
                    )}
                    {step.cta && (
                      <Link
                        to={step.cta.href}
                        className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {step.cta.label}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

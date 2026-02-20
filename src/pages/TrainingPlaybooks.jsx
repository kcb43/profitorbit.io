import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Map, ChevronRight, Clock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { allPlaybooks } from '@/lib/training';
import PlaybookCard from '@/components/training/PlaybookCard';
import { supabase } from '@/integrations/supabase';

export default function TrainingPlaybooks() {
  const [progressMap, setProgressMap] = useState({});

  // Load all playbook progress for the current user
  useEffect(() => {
    async function loadProgress() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('playbook_progress')
        .select('playbook_slug, completed_step_ids, completed_at')
        .eq('user_id', session.user.id);
      if (data) {
        const map = {};
        data.forEach((row) => { map[row.playbook_slug] = row; });
        setProgressMap(map);
      }
    }
    loadProgress();
  }, []);

  const inProgress = allPlaybooks.filter((pb) => {
    const prog = progressMap[pb.slug];
    return prog && prog.completed_step_ids?.length > 0 && !prog.completed_at;
  });

  const notStarted = allPlaybooks.filter((pb) => {
    const prog = progressMap[pb.slug];
    return !prog || prog.completed_step_ids?.length === 0;
  });

  const completed = allPlaybooks.filter((pb) => {
    return progressMap[pb.slug]?.completed_at;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/training" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <GraduationCap className="w-3.5 h-3.5" />
              Training Center
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Reselling Playbooks</span>
          </nav>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Map className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Reselling Playbooks</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Guided workflows that take you through complete reselling operations step by step. Track your progress and pick up where you left off.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-10">
        {/* In progress */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              Continue where you left off
            </h2>
            <div className="grid gap-3">
              {inProgress.map((pb) => (
                <PlaybookCard key={pb.slug} playbook={pb} progress={progressMap[pb.slug]} />
              ))}
            </div>
          </section>
        )}

        {/* All / not started */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            {inProgress.length > 0 ? 'All Playbooks' : 'Get started'}
          </h2>
          <div className="grid gap-3">
            {allPlaybooks.map((pb) => (
              <PlaybookCard key={pb.slug} playbook={pb} progress={progressMap[pb.slug]} />
            ))}
          </div>
        </section>

        {/* How playbooks work */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-3">How playbooks work</h3>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-2xl mb-1">✅</div>
              <div className="font-medium text-foreground mb-1">Check off steps</div>
              <div className="text-muted-foreground">Mark each step complete as you finish it. Progress saves automatically.</div>
            </div>
            <div>
              <div className="text-2xl mb-1">📖</div>
              <div className="font-medium text-foreground mb-1">Read the guide</div>
              <div className="text-muted-foreground">Each step links to a detailed guide with everything you need to know.</div>
            </div>
            <div>
              <div className="text-2xl mb-1">🚀</div>
              <div className="font-medium text-foreground mb-1">Take action</div>
              <div className="text-muted-foreground">CTA buttons deep-link into the right section of Orben so you can act immediately.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

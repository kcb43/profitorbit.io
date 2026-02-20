import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Map, ChevronRight, Clock, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPlaybookBySlug, getGuideBySlug } from '@/lib/training';
import PlaybookProgress from '@/components/training/PlaybookProgress';
import GuideCard from '@/components/training/GuideCard';
import { supabase } from '@/integrations/supabase';

export default function TrainingPlaybook() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const playbook = getPlaybookBySlug(slug);
  const [initialProgress, setInitialProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(true);

  // Gather related guides (guides that share tags with the playbook)
  const relatedGuides = playbook
    ? playbook.steps
        .filter((s) => s.guideSlug)
        .map((s) => getGuideBySlug(s.guideSlug))
        .filter(Boolean)
        .filter((g, i, arr) => arr.findIndex((x) => x.slug === g.slug) === i) // dedupe
        .slice(0, 4)
    : [];

  useEffect(() => {
    if (!slug) return;
    async function loadProgress() {
      setLoadingProgress(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('playbook_progress')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('playbook_slug', slug)
          .maybeSingle();
        setInitialProgress(data || null);
      } finally {
        setLoadingProgress(false);
      }
    }
    loadProgress();
  }, [slug]);

  if (!playbook) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Playbook not found</h2>
          <p className="text-muted-foreground mb-4">We couldn't find that playbook.</p>
          <Button onClick={() => navigate('/training/playbooks')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Playbooks
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/training" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <GraduationCap className="w-3.5 h-3.5" />
              Training Center
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/training/playbooks" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Map className="w-3.5 h-3.5" />
              Playbooks
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{playbook.title}</span>
          </nav>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{playbook.title}</h1>
          <p className="text-muted-foreground mb-4">{playbook.description}</p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {playbook.estimatedTotalTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                ~{playbook.estimatedTotalTime} min total
              </span>
            )}
            <span>{playbook.steps?.length} steps</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {loadingProgress ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <PlaybookProgress
            playbook={playbook}
            initialProgress={initialProgress}
          />
        )}

        {/* Related guides */}
        {relatedGuides.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Guides in this playbook</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedGuides.map((g) => (
                <GuideCard key={g.slug} guide={g} compact />
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-10 pt-6 border-t border-border">
          <Link
            to="/training/playbooks"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Playbooks
          </Link>
        </div>
      </div>
    </div>
  );
}

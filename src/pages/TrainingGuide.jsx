import React, { useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import {
  ArrowLeft,
  Clock,
  Calendar,
  ChevronRight,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getGuideBySlug, getRelatedGuides, getGuidesByCategory, getCategories, CATEGORY_META } from '@/lib/training';
import TableOfContents from '@/components/training/TableOfContents';
import GuideFeedback from '@/components/training/GuideFeedback';
import GuideCard from '@/components/training/GuideCard';
import { supabase } from '@/integrations/supabase';

const DIFFICULTY_COLORS = {
  beginner: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  intermediate: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  advanced: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

// Custom markdown components for styled rendering
const mdComponents = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-semibold text-foreground mt-8 mb-3 border-b border-border pb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-semibold text-foreground mt-6 mb-2" {...props}>{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-7 text-foreground/90 mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-sm text-foreground/90">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-sm text-foreground/90">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 py-1 my-4 bg-primary/5 rounded-r-lg text-sm text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ inline, children, ...props }) => {
    if (inline) {
      return (
        <code className="bg-muted text-foreground font-mono text-xs px-1.5 py-0.5 rounded" {...props}>
          {children}
        </code>
      );
    }
    return (
      <pre className="bg-muted rounded-xl p-4 overflow-x-auto my-4">
        <code className="font-mono text-xs text-foreground leading-relaxed" {...props}>
          {children}
        </code>
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-6 rounded-xl border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-foreground/90 border-b border-border/50 last:border-0">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <Link
      to={href || '#'}
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </Link>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  hr: () => <hr className="border-border my-6" />,
};

export default function TrainingGuide() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const guide = getGuideBySlug(slug);
  const related = useMemo(() => guide ? getRelatedGuides(guide, 3) : [], [guide]);

  // Category sidebar data
  const categories = getCategories();
  const guidesByCategory = getGuidesByCategory();

  // Record view
  useEffect(() => {
    if (!slug) return;
    async function recordView() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/training/view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ slug }),
        });
      } catch {
        // Non-critical
      }
    }
    recordView();
  }, [slug]);

  if (!guide) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Guide not found</h2>
          <p className="text-muted-foreground mb-4">We couldn't find a guide with that name.</p>
          <Button onClick={() => navigate('/training')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Training Center
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/training" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <GraduationCap className="w-3.5 h-3.5" />
              Training Center
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground/70">{guide.category}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{guide.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* ─── Left sidebar — category navigation ─────────────────────── */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-6 space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  All Guides
                </div>
                {categories.map((cat) => {
                  const catGuides = guidesByCategory[cat] || [];
                  const isActiveCategory = cat === guide.category;
                  return (
                    <div key={cat} className="mb-4">
                      <div className={cn(
                        'text-xs font-semibold mb-1.5 px-2 py-1 rounded',
                        isActiveCategory ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                      )}>
                        {cat}
                      </div>
                      <ul className="space-y-0.5">
                        {catGuides.map((g) => (
                          <li key={g.slug}>
                            <Link
                              to={`/training/${g.slug}`}
                              className={cn(
                                'block text-xs px-2 py-1.5 rounded transition-colors leading-snug',
                                g.slug === guide.slug
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              )}
                            >
                              {g.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* ─── Main content ────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {/* Guide header */}
            <div className="mb-6">
              <Link
                to="/training"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-3 h-3" />
                Training Center
              </Link>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={cn(
                  'text-xs font-semibold uppercase tracking-wider rounded px-2 py-0.5',
                  DIFFICULTY_COLORS[guide.difficulty] || DIFFICULTY_COLORS.beginner
                )}>
                  {guide.difficulty}
                </span>
                <span className="text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">
                  {guide.category}
                </span>
                {guide.isNew && (
                  <span className="text-xs font-semibold bg-primary/10 text-primary rounded px-2 py-0.5">New</span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{guide.title}</h1>
              <p className="text-muted-foreground">{guide.description}</p>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                {guide.estimatedTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {guide.estimatedTime} min read
                  </span>
                )}
                {guide.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Updated {guide.updatedAt}
                  </span>
                )}
              </div>
            </div>

            {/* Markdown content */}
            <article className="max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={mdComponents}
              >
                {guide._rawContent}
              </ReactMarkdown>
            </article>

            {/* Divider */}
            <hr className="border-border my-8" />

            {/* Feedback */}
            <GuideFeedback slug={guide.slug} className="mb-8" />

            {/* Related guides */}
            {related.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Related guides</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((g) => (
                    <GuideCard key={g.slug} guide={g} compact />
                  ))}
                </div>
              </div>
            )}
          </main>

          {/* ─── Right rail — table of contents ─────────────────────────── */}
          <aside className="hidden xl:block w-52 flex-shrink-0">
            <TableOfContents content={guide._rawContent} />
          </aside>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  GraduationCap,
  Rocket,
  Sparkles,
  Map,
  ArrowRight,
  Clock,
  Flame,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  allGuides,
  allPlaybooks,
  getFeaturedGuides,
  getRecentGuides,
  getGuidesByCategory,
  getCategories,
  searchGuides,
} from '@/lib/training';
import GuideCard from '@/components/training/GuideCard';
import CategoryCard from '@/components/training/CategoryCard';
import PlaybookCard from '@/components/training/PlaybookCard';
import TrainingSearch from '@/components/training/TrainingSearch';

export default function Training() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCategory = searchParams.get('category') || '';

  const categories = getCategories();
  const guidesByCategory = getGuidesByCategory();
  const featured = getFeaturedGuides(3);
  const recent = getRecentGuides(5);
  const featuredPlaybooks = allPlaybooks.filter((p) => p.isFeatured).slice(0, 3);

  const displayedGuides = useMemo(() => {
    let guides = allGuides;
    if (searchQuery.trim().length >= 2) {
      guides = searchGuides(searchQuery);
    } else if (selectedCategory) {
      guides = allGuides.filter((g) => g.category === selectedCategory);
    }
    return guides;
  }, [searchQuery, selectedCategory]);

  const isFiltered = searchQuery.trim().length >= 2 || selectedCategory;

  function clearFilters() {
    setSearchQuery('');
    setSearchParams({});
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero header ───────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Training Center</h1>
          </div>
          <p className="text-muted-foreground text-base max-w-xl mb-6">
            Guides, playbooks, and step-by-step workflows to help you sell more, earn more, and spend less time managing it.
          </p>
          {/* Search */}
          <TrainingSearch
            className="max-w-lg"
            onSearch={setSearchQuery}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">

        {/* ─── Search / filtered results ───────────────────────────────────── */}
        {isFiltered ? (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {searchQuery ? `Results for "${searchQuery}"` : selectedCategory}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({displayedGuides.length} guide{displayedGuides.length !== 1 ? 's' : ''})
                </span>
              </h2>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filter
              </Button>
            </div>
            {displayedGuides.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayedGuides.map((guide) => (
                  <GuideCard key={guide.slug} guide={guide} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium mb-1">No guides found</p>
                <p className="text-sm">Try a different search term or browse categories below.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Browse all guides
                </Button>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* ─── Featured guides ─────────────────────────────────────────── */}
            {featured.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h2 className="text-lg font-semibold text-foreground">Featured Guides</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((guide) => (
                    <GuideCard key={guide.slug} guide={guide} />
                  ))}
                </div>
              </section>
            )}

            {/* ─── Reselling Playbooks CTA ─────────────────────────────────── */}
            <section className="mb-10">
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Map className="w-5 h-5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">Guided workflows</span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Reselling Playbooks</h2>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Step-by-step playbooks that walk you through complete workflows — from starting your business to shipping efficiently. Track your progress as you go.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {featuredPlaybooks.map((pb) => (
                        <span key={pb.slug} className="text-xs bg-card border border-border rounded-full px-3 py-1 text-muted-foreground">
                          {pb.title}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Link to="/training/playbooks">
                      <Button className="gap-2">
                        <Map className="w-4 h-4" />
                        View Playbooks
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* ─── Category cards ──────────────────────────────────────────── */}
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="w-4 h-4 text-emerald-500" />
                <h2 className="text-lg font-semibold text-foreground">Browse by Category</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((cat) => (
                  <CategoryCard
                    key={cat}
                    category={cat}
                    guideCount={guidesByCategory[cat]?.length || 0}
                  />
                ))}
              </div>
            </section>

            {/* ─── What's new ──────────────────────────────────────────────── */}
            {recent.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <h2 className="text-lg font-semibold text-foreground">Recently Updated</h2>
                </div>
                <div className="grid gap-2">
                  {recent.map((guide) => (
                    <GuideCard key={guide.slug} guide={guide} compact />
                  ))}
                </div>
              </section>
            )}

            {/* ─── All guides by category ──────────────────────────────────── */}
            {categories.map((cat) => {
              const guides = guidesByCategory[cat] || [];
              if (guides.length === 0) return null;
              return (
                <section key={cat} className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">{cat}</h2>
                    <button
                      onClick={() => setSearchParams({ category: cat })}
                      className="text-sm text-primary hover:underline underline-offset-2"
                    >
                      See all {guides.length}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {guides.slice(0, 6).map((guide) => (
                      <GuideCard key={guide.slug} guide={guide} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

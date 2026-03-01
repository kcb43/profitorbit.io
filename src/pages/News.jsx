import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ExternalLink, Loader2, X, Newspaper,
  ShoppingBag, TrendingUp, Store, RefreshCw,
  Clock, ChevronRight, Zap, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNewsFeed, getNewsFeeds, markNewsSeen, triggerIngest } from '@/api/newsApi';
import { formatDistanceToNow, parseISO } from 'date-fns';

// ─── Tag / filter config ────────────────────────────────────────────────────

const FILTER_CHIPS = [
  { id: 'all',         label: 'All',         icon: Newspaper },
  { id: 'marketplace', label: 'Marketplace',  icon: Store },
  { id: 'product',     label: 'Products',     icon: ShoppingBag },
  { id: 'trends',      label: 'Trends',       icon: TrendingUp },
];

const TAG_COLORS = {
  marketplace: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ebay:        'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  mercari:     'bg-red-500/10 text-red-600 dark:text-red-400',
  poshmark:    'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  depop:       'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  product:     'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  electronics: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  luxury:      'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  collectibles:'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  recalls:     'bg-red-600/10 text-red-700 dark:text-red-400',
  trends:      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  resale:      'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  drops:       'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  restock:     'bg-lime-500/10 text-lime-700 dark:text-lime-400',
  outage:      'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

function tagClass(tag) {
  return TAG_COLORS[tag] || 'bg-muted text-muted-foreground';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanSummary(raw) {
  if (!raw) return null;
  let t = String(raw)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/submitted\s+by\s+\/u\/\S+/gi, '')
    .replace(/\[link\]/gi, '').replace(/\[comments\]/gi, '')
    .replace(/\s{2,}/g, ' ').trim();
  return t || null;
}

function relativeTime(item) {
  const raw = item.iso_date || item.published_at || item.created_at;
  if (!raw) return null;
  try {
    return formatDistanceToNow(typeof raw === 'string' ? parseISO(raw) : new Date(raw), { addSuffix: true });
  } catch { return null; }
}

// Tag-based accent dot color
const TAG_DOT_COLORS = {
  marketplace: 'bg-blue-500',
  product: 'bg-purple-500',
  trends: 'bg-emerald-500',
  resale: 'bg-teal-500',
  recalls: 'bg-red-500',
};

function getAccentDot(tags) {
  if (!tags?.length) return 'bg-muted-foreground/30';
  for (const key of Object.keys(TAG_DOT_COLORS)) {
    if (tags.includes(key)) return TAG_DOT_COLORS[key];
  }
  return 'bg-muted-foreground/30';
}

// ─── News Card ───────────────────────────────────────────────────────────────

function NewsCard({ item }) {
  const time = relativeTime(item);
  const summary = cleanSummary(item.summary);
  const dotColor = getAccentDot(item.tags);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="rounded-xl border bg-card hover:shadow-md transition-all duration-200 overflow-hidden">
        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
          {/* Accent dot */}
          <div className={cn("w-1 rounded-full flex-shrink-0 self-stretch", dotColor)} />

          {/* Thumbnail */}
          {item.thumbnail && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.parentElement.style.display = 'none'; }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-start gap-2 mb-1">
              <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Summary */}
            {summary && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                {summary}
              </p>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {item.source_name && (
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-md bg-muted font-medium">
                  {item.source_name}
                </span>
              )}
              {time && (
                <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {time}
                </span>
              )}
              {/* Tags */}
              <div className="flex flex-wrap gap-1 ml-auto">
                {(item.tags || []).slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className={cn('text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-medium capitalize', tagClass(tag))}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function NewsCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        <Skeleton className="w-1 rounded-full self-stretch" />
        <Skeleton className="w-20 h-20 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-12 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Left Rail Feed List ─────────────────────────────────────────────────────

function FeedSidebar({ activeTag, onTagSelect }) {
  const { data } = useQuery({
    queryKey: ['newsFeeds'],
    queryFn: getNewsFeeds,
    staleTime: 5 * 60_000
  });

  const feeds = data?.feeds || [];

  const grouped = {};
  feeds.forEach(f => {
    const primary = (f.tags || [])[0] || 'other';
    if (!grouped[primary]) grouped[primary] = [];
    grouped[primary].push(f);
  });

  const SECTIONS = [
    { key: 'marketplace', label: 'Marketplace', icon: Store },
    { key: 'product',     label: 'Products',    icon: ShoppingBag },
    { key: 'trends',      label: 'Trends',      icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      {SECTIONS.map(({ key, label, icon: Icon }) => {
        const items = grouped[key] || [];
        if (!items.length) return null;
        return (
          <div key={key}>
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2 px-1">
              <Icon className="w-3 h-3" />
              {label}
            </h4>
            <ul className="space-y-0.5">
              {items.map(feed => (
                <li key={feed.id}>
                  <button
                    onClick={() => onTagSelect(key === activeTag ? 'all' : key)}
                    className={cn(
                      'w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between group/feed',
                      activeTag === key
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="truncate">{feed.name}</span>
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-0 group-hover/feed:opacity-100 transition-opacity" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ searchQuery, onClear, isIngesting }) {
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Search className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No results for "{searchQuery}"</h3>
        <p className="text-sm text-muted-foreground mb-4">Try a different keyword or clear the search.</p>
        <Button variant="outline" size="sm" onClick={onClear}>
          <X className="w-3.5 h-3.5 mr-1.5" /> Clear search
        </Button>
      </div>
    );
  }
  if (isIngesting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-12 w-12 text-primary/40 mb-4 animate-spin" />
        <h3 className="text-lg font-semibold mb-1">Fetching articles...</h3>
        <p className="text-sm text-muted-foreground">Pulling the latest news from our feeds. This takes about 10-20 seconds.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Newspaper className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No news yet</h3>
      <p className="text-sm text-muted-foreground">Articles are fetched automatically. Try refreshing in a moment.</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function News() {
  const queryClient = useQueryClient();

  const [inputValue, setInputValue]     = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [activeTag, setActiveTag]       = useState('all');
  const [sort, setSort]                 = useState('newest');
  const [isSearchFocused, setFocused]   = useState(false);
  const [isSticky, setIsSticky]         = useState(false);
  const [isIngesting, setIsIngesting]   = useState(false);
  const ingestTriggered                 = useRef(false);

  const loadMoreRef  = useRef(null);
  const sentinelRef  = useRef(null);
  const searchTimer  = useRef(null);

  const handleSearchChange = useCallback((val) => {
    setInputValue(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 400);
  }, []);

  const clearSearch = useCallback(() => {
    setInputValue('');
    setSearchQuery('');
    clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const { mutate: markSeen } = useMutation({
    mutationFn: markNewsSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['newsBadge'] })
  });

  useEffect(() => { markSeen(); }, [markSeen]);

  const { mutate: runIngest } = useMutation({
    mutationFn: triggerIngest,
    onSettled: () => {
      setTimeout(() => {
        setIsIngesting(false);
        queryClient.invalidateQueries({ queryKey: ['newsFeed'] });
      }, 1500);
    },
  });

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, error, refetch, isFetching
  } = useInfiniteQuery({
    queryKey: ['newsFeed', searchQuery, activeTag, sort],
    queryFn: ({ pageParam = 0 }) =>
      getNewsFeed({ q: searchQuery || undefined, tag: activeTag, sort, limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.items || lastPage.items.length < PAGE_SIZE) return undefined;
      return allPages.reduce((acc, p) => acc + (p.items?.length || 0), 0);
    },
    staleTime: 2 * 60_000,
    refetchInterval: 10 * 60_000
  });

  const allItems   = data?.pages.flatMap(p => p.items || []) || [];
  const total      = data?.pages[0]?.total || 0;
  const needsIngest = data?.pages[0]?.needsIngest === true;

  useEffect(() => {
    if (!isLoading && needsIngest && !ingestTriggered.current) {
      ingestTriggered.current = true;
      setIsIngesting(true);
      runIngest();
    }
  }, [isLoading, needsIngest, runIngest]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchNextPage(); },
      { threshold: 0.1 }
    );
    obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      {/* Sticky search bar */}
      <div className={cn(
        'sticky top-0 z-40 -mx-2 sm:-mx-4 md:-mx-6 lg:-mx-8 px-2 sm:px-4 md:px-6 lg:px-8 py-3 mb-4 transition-all duration-300',
        isSticky ? 'bg-background/80 backdrop-blur-xl border-b border-border/60 shadow-sm' : 'bg-transparent'
      )}>
        <div className="max-w-7xl mx-auto">
          <div className="relative flex items-center">
            <div className={cn(
              'absolute left-3 flex items-center pointer-events-none transition-all duration-200',
              isSearchFocused ? 'text-primary scale-110' : 'text-muted-foreground'
            )}>
              {(isLoading || isFetching) && searchQuery
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />}
            </div>
            <Input
              value={inputValue}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search news..."
              className={cn(
                'pl-9 pr-10 h-11 rounded-xl border-2 transition-all duration-200 bg-card/60 text-sm',
                isSearchFocused
                  ? 'border-primary/60 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] bg-card'
                  : 'border-border/50 hover:border-border'
              )}
            />
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className={cn(
                'absolute right-3 w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200',
                inputValue ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Newspaper className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              News
              {!isLoading && total > 0 && (
                <span className="text-base font-normal text-muted-foreground ml-1">
                  · {total.toLocaleString()} articles
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Marketplace updates, product launches, and resale trends
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
          >
            {(isLoading || isFetching)
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Refreshing</>
              : <><RefreshCw className="w-4 h-4 mr-1.5" /> Refresh</>}
          </Button>
        </div>

        {/* Filter chips + sort */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {FILTER_CHIPS.map(chip => {
            const Icon = chip.icon;
            const active = activeTag === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveTag(chip.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {chip.label}
              </button>
            );
          })}

          {/* Sort toggle */}
          <div className="ml-auto flex items-center gap-0.5 border rounded-full px-1 py-0.5 bg-card">
            {[
              { id: 'newest', label: 'Newest', icon: Zap },
              { id: 'relevance', label: 'Relevant', icon: TrendingUp },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all',
                  sort === s.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <s.icon className="w-3 h-3" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6">
          {/* Left rail */}
          <aside className="hidden lg:block w-52 flex-shrink-0">
            <div className="sticky top-24 bg-card border rounded-xl p-3">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Feeds
              </h3>
              <FeedSidebar activeTag={activeTag} onTagSelect={setActiveTag} />
            </div>
          </aside>

          {/* Main feed */}
          <div className="flex-1 min-w-0">
            {!isLoading && allItems.length > 0 && (
              <p className="text-xs text-muted-foreground mb-3 px-1">
                {searchQuery
                  ? `${allItems.length} result${allItems.length !== 1 ? 's' : ''} for "${searchQuery}"`
                  : `${total.toLocaleString()} article${total !== 1 ? 's' : ''}`}
              </p>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <NewsCardSkeleton key={i} />)}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Newspaper className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Could not load news</h3>
                <p className="text-sm text-muted-foreground mb-4">{error?.message || 'An error occurred.'}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
                </Button>
              </div>
            ) : allItems.length === 0 ? (
              <EmptyState searchQuery={searchQuery} onClear={clearSearch} isIngesting={isIngesting} />
            ) : (
              <div className="space-y-2.5">
                {allItems.map(item => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {hasNextPage && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading more...
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>Load more</Button>
                )}
              </div>
            )}

            {!isLoading && allItems.length > 0 && !hasNextPage && (
              <p className="text-center text-xs text-muted-foreground py-8">
                End of feed · {allItems.length} articles shown
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Training Center content helpers
 *
 * Uses Vite's import.meta.glob with ?raw to load .md files at build time.
 * Frontmatter is parsed with a lightweight inline parser — no Node deps needed.
 */

// ─── Frontmatter parser ───────────────────────────────────────────────────────

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { metadata: {}, content: raw };

  const yamlStr = match[1];
  const content = match[2];
  const metadata = {};

  for (const line of yamlStr.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Inline arrays: ["a", "b"] or [a, b]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (value !== '' && !isNaN(Number(value))) {
      value = Number(value);
    }

    metadata[key] = value;
  }

  return { metadata, content };
}

// ─── Guide loader ─────────────────────────────────────────────────────────────

// Vite glob import — all .md files under content/training/guides/
const rawGuideModules = import.meta.glob('../content/training/guides/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function slugFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '');
}

/** All guides with metadata + slug, sorted by category order then title */
export const allGuides = Object.entries(rawGuideModules)
  .map(([path, raw]) => {
    const { metadata, content } = parseFrontmatter(raw);
    return {
      slug: metadata.slug || slugFromPath(path),
      title: metadata.title || slugFromPath(path),
      description: metadata.description || '',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      updatedAt: metadata.updatedAt || '',
      createdAt: metadata.createdAt || '',
      category: metadata.category || 'General',
      order: typeof metadata.order === 'number' ? metadata.order : 999,
      difficulty: metadata.difficulty || 'beginner',
      estimatedTime: typeof metadata.estimatedTime === 'number' ? metadata.estimatedTime : null,
      isFeatured: metadata.isFeatured === true,
      isNew: metadata.isNew === true,
      _rawContent: content,
    };
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

/** Unique categories in display order */
export const CATEGORY_ORDER = [
  'Getting Started',
  'Feature Guides',
  'Troubleshooting',
  'Policies & Limits',
];

export function getCategories() {
  const seen = new Set();
  const cats = [];
  for (const guide of allGuides) {
    if (!seen.has(guide.category)) {
      seen.add(guide.category);
      cats.push(guide.category);
    }
  }
  // Sort by CATEGORY_ORDER, then alphabetically for unknown categories
  return cats.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** Guides grouped by category */
export function getGuidesByCategory() {
  const map = {};
  for (const guide of allGuides) {
    if (!map[guide.category]) map[guide.category] = [];
    map[guide.category].push(guide);
  }
  return map;
}

/** Featured guides */
export function getFeaturedGuides(limit = 3) {
  return allGuides.filter((g) => g.isFeatured).slice(0, limit);
}

/** Recently updated guides */
export function getRecentGuides(limit = 5) {
  return [...allGuides]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, limit);
}

/** Find a guide by slug */
export function getGuideBySlug(slug) {
  return allGuides.find((g) => g.slug === slug) || null;
}

/** Search guides by query string */
export function searchGuides(query) {
  if (!query || query.trim().length < 2) return allGuides;
  const q = query.toLowerCase();
  return allGuides.filter(
    (g) =>
      g.title.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.tags.some((t) => t.toLowerCase().includes(q)) ||
      g.category.toLowerCase().includes(q)
  );
}

/** Guides related to a given guide (same category or overlapping tags) */
export function getRelatedGuides(guide, limit = 3) {
  if (!guide) return [];
  return allGuides
    .filter((g) => {
      if (g.slug === guide.slug) return false;
      const sameCategory = g.category === guide.category;
      const sharedTags = g.tags.some((t) => guide.tags.includes(t));
      return sameCategory || sharedTags;
    })
    .slice(0, limit);
}

// ─── Playbook loader ──────────────────────────────────────────────────────────

const rawPlaybookModules = import.meta.glob('../content/training/playbooks/*.json', {
  eager: true,
});

export const allPlaybooks = Object.values(rawPlaybookModules)
  .map((mod) => mod.default || mod)
  .sort((a, b) => (a.order || 99) - (b.order || 99) || a.title.localeCompare(b.title));

export function getPlaybookBySlug(slug) {
  return allPlaybooks.find((p) => p.slug === slug) || null;
}

// ─── Category metadata ────────────────────────────────────────────────────────

export const CATEGORY_META = {
  'Getting Started': {
    icon: 'Rocket',
    description: 'Connect your marketplaces, import inventory, and make your first sale.',
    color: 'emerald',
  },
  'Feature Guides': {
    icon: 'Sparkles',
    description: 'Deep dives into Analytics, Crosslisting, Pro Tools, and more.',
    color: 'violet',
  },
  Troubleshooting: {
    icon: 'Wrench',
    description: 'Fixes for common connection issues, import problems, and errors.',
    color: 'amber',
  },
  'Policies & Limits': {
    icon: 'Shield',
    description: 'Rate limits, data privacy, and marketplace ToS considerations.',
    color: 'blue',
  },
};

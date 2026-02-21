/**
 * Settings Registry – single source of truth for every settings section.
 *
 * To add a new section: add one entry here and create the corresponding page.
 */

import {
  User,
  Shield,
  Bell,
  Palette,
  ShoppingBag,
  BarChart3,
  Truck,
} from 'lucide-react';

export const SETTINGS_SECTIONS = [
  // ── Account & Security ────────────────────────────────────────────────────
  {
    id: 'account',
    title: 'Account',
    description: 'Profile, display name, email, and avatar',
    icon: User,
    route: '/Settings/account',
    category: 'Account & Security',
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    searchKeywords: ['profile', 'name', 'email', 'avatar', 'account', 'photo'],
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Password reset and active session info',
    icon: Shield,
    route: '/Settings/security',
    category: 'Account & Security',
    color: 'red',
    gradient: 'from-red-500 to-rose-600',
    searchKeywords: ['password', 'login', 'sessions', 'security', '2fa'],
  },

  // ── Preferences ───────────────────────────────────────────────────────────
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Email, push, and in-app notification preferences',
    icon: Bell,
    route: '/Settings/notifications',
    category: 'Preferences',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    searchKeywords: ['email', 'push', 'alerts', 'notifications', 'digest', 'deals', 'returns'],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Theme, layout density, and display preferences',
    icon: Palette,
    route: '/Settings/appearance',
    category: 'Preferences',
    color: 'purple',
    gradient: 'from-purple-500 to-fuchsia-600',
    searchKeywords: ['theme', 'dark', 'light', 'green', 'color', 'density', 'delete', 'smart routing'],
  },
  {
    id: 'reports',
    title: 'Reports & Exports',
    description: 'Default date range, export format, and report options',
    icon: BarChart3,
    route: '/Settings/reports',
    category: 'Preferences',
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    searchKeywords: ['reports', 'export', 'csv', 'excel', 'pdf', 'date range', 'fees', 'default'],
  },

  // ── Selling ───────────────────────────────────────────────────────────────
  {
    id: 'fulfillment',
    title: 'Fulfillment',
    description: 'Pickup location, shipping notes, and platform-specific fulfillment lines for AI descriptions',
    icon: Truck,
    route: '/Settings/fulfillment',
    category: 'Selling',
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-600',
    searchKeywords: ['pickup', 'shipping', 'fulfillment', 'location', 'facebook pickup', 'ship', 'description ai'],
  },

  // ── Integrations ──────────────────────────────────────────────────────────
  {
    id: 'marketplaces',
    title: 'Marketplace Connections',
    description: 'Connect eBay, Mercari, Facebook Marketplace, and Poshmark',
    icon: ShoppingBag,
    route: '/Settings/marketplaces',
    category: 'Integrations',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    searchKeywords: ['ebay', 'mercari', 'facebook', 'poshmark', 'connect', 'integration', 'oauth', 'extension'],
  },
];

export const SETTINGS_CATEGORIES = ['Account & Security', 'Preferences', 'Selling', 'Integrations'];

/** Look up a section by id. */
export function getSectionById(id) {
  return SETTINGS_SECTIONS.find((s) => s.id === id) ?? null;
}

/** Group sections by category in the canonical order. */
export function getSectionsByCategory() {
  return SETTINGS_CATEGORIES.map((cat) => ({
    category: cat,
    sections: SETTINGS_SECTIONS.filter((s) => s.category === cat),
  }));
}

/** Filter sections by a search query (title + description + keywords). */
export function searchSections(query) {
  if (!query?.trim()) return SETTINGS_SECTIONS;
  const q = query.toLowerCase();
  return SETTINGS_SECTIONS.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.searchKeywords ?? []).some((k) => k.toLowerCase().includes(q)),
  );
}

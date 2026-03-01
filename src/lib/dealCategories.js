import {
  ShoppingCart,
  AlertTriangle,
  Bell,
  Store,
  UtensilsCrossed,
} from 'lucide-react';

/**
 * The 5 deal categories — single source of truth.
 * Used by Deals.jsx (user feed) and DealCurator.jsx (admin).
 * The `key` is stored in the deals.category column.
 */
export const DEAL_CATEGORIES = [
  {
    key: 'amazon-deals',
    label: 'Amazon Deals',
    description: 'All Amazon & Woot deals',
    icon: ShoppingCart,
    accent: '#f97316',
    bgChip: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-l-orange-500',
    ringColor: 'ring-orange-500/30',
    dotColor: 'bg-orange-500',
  },
  {
    key: 'price-drops',
    label: 'Price Drops',
    description: 'Hand-picked major price errors & deals',
    icon: AlertTriangle,
    accent: '#ef4444',
    bgChip: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-l-red-500',
    ringColor: 'ring-red-500/30',
    dotColor: 'bg-red-500',
  },
  {
    key: 'price-alerts',
    label: 'Price Alerts',
    description: 'Bulk price errors — gems mixed with volume',
    icon: Bell,
    accent: '#a855f7',
    bgChip: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-l-purple-500',
    ringColor: 'ring-purple-500/30',
    dotColor: 'bg-purple-500',
  },
  {
    key: 'store-deals',
    label: 'Store Deals',
    description: 'Target, Walmart, Home Depot, Lowes & more',
    icon: Store,
    accent: '#3b82f6',
    bgChip: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-l-blue-500',
    ringColor: 'ring-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  {
    key: 'food-grocery',
    label: 'Food & Grocery',
    description: 'Food deals, coupons, holiday food events',
    icon: UtensilsCrossed,
    accent: '#10b981',
    bgChip: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-l-emerald-500',
    ringColor: 'ring-emerald-500/30',
    dotColor: 'bg-emerald-500',
  },
];

export const CATEGORY_MAP = Object.fromEntries(
  DEAL_CATEGORIES.map((c) => [c.key, c])
);

export const DEFAULT_VISIBLE_CATEGORIES = DEAL_CATEGORIES.map((c) => c.key);

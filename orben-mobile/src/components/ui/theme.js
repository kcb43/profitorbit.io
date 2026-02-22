/**
 * Orben Mobile Design System
 * Matches the web app's color tokens exactly.
 */

export const colors = {
  // Brand
  primary:        '#10b981',
  primaryDark:    '#059669',
  primaryLight:   '#34d399',
  primaryMuted:   '#d1fae5',

  // Backgrounds
  bg:             '#0a0a0a',
  bgCard:         '#1a1a1a',
  bgCardHover:    '#242424',
  bgInput:        '#141414',
  bgSection:      '#111111',

  // Borders
  border:         '#2a2a2a',
  borderLight:    '#333333',

  // Text
  textPrimary:    '#f5f5f5',
  textSecondary:  '#a3a3a3',
  textMuted:      '#6b6b6b',
  textInverse:    '#0a0a0a',

  // Status
  success:        '#10b981',
  warning:        '#f59e0b',
  danger:         '#ef4444',
  dangerMuted:    '#7f1d1d',
  info:           '#3b82f6',

  // Platform colors
  mercari:        '#e8300b',
  ebay:           '#e43137',
  facebook:       '#1877f2',

  // Misc
  white:          '#ffffff',
  black:          '#000000',
  overlay:        'rgba(0,0,0,0.6)',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' },
  h4: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodySmall: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 11, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  mono: { fontSize: 12, fontFamily: 'monospace' },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

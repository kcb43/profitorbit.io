import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

const VARIANTS = {
  success:    { bg: '#052e16', text: '#4ade80', border: '#14532d' },
  warning:    { bg: '#422006', text: '#fbbf24', border: '#78350f' },
  danger:     { bg: '#450a0a', text: '#f87171', border: '#7f1d1d' },
  info:       { bg: '#0c1a3a', text: '#60a5fa', border: '#1e3a6e' },
  muted:      { bg: '#1a1a1a', text: '#a3a3a3', border: '#2a2a2a' },
  primary:    { bg: '#022c22', text: '#10b981', border: '#065f46' },
  mercari:    { bg: '#3a0a02', text: '#f97316', border: '#7c2d12' },
  ebay:       { bg: '#3a0205', text: '#f87171', border: '#7f1d1d' },
  facebook:   { bg: '#0c1d3a', text: '#60a5fa', border: '#1e3a8a' },
};

export default function Badge({ label, variant = 'muted', size = 'sm', style }) {
  const v = VARIANTS[variant] || VARIANTS.muted;
  return (
    <View style={[
      styles.badge,
      size === 'md' && styles.badgeMd,
      { backgroundColor: v.bg, borderColor: v.border },
      style,
    ]}>
      <Text style={[
        styles.label,
        size === 'md' && styles.labelMd,
        { color: v.text },
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
  labelMd: {
    fontSize: 12,
  },
});

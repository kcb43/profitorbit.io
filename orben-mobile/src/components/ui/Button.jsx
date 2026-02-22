import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

/**
 * variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
 * size: 'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  style,
  textStyle,
  fullWidth = true,
}) {
  const baseStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    disabled && styles.disabled,
    fullWidth && styles.fullWidth,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${size}`],
    styles[`labelVariant_${variant}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={baseStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.primary}
        />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={labelStyle}>{children}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { marginRight: 2 },

  // Sizes
  size_sm: { paddingVertical: spacing.sm,  paddingHorizontal: spacing.md },
  size_md: { paddingVertical: 13,          paddingHorizontal: spacing.xl },
  size_lg: { paddingVertical: 16,          paddingHorizontal: spacing.xxl },

  // Variants
  variant_primary:   { backgroundColor: colors.primary },
  variant_secondary: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  variant_danger:    { backgroundColor: colors.danger },
  variant_ghost:     { backgroundColor: 'transparent' },
  variant_outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },

  // Labels
  label: { ...typography.body, fontWeight: '600' },
  label_sm: { fontSize: 13 },
  label_md: { fontSize: 15 },
  label_lg: { fontSize: 17 },

  labelVariant_primary:   { color: colors.textInverse },
  labelVariant_secondary: { color: colors.textPrimary },
  labelVariant_danger:    { color: colors.white },
  labelVariant_ghost:     { color: colors.primary },
  labelVariant_outline:   { color: colors.primary },

  disabled: { opacity: 0.45 },
});

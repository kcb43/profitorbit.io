import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from './theme';
import Button from './Button';

export default function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button
          onPress={onAction}
          variant="outline"
          size="sm"
          style={styles.btn}
          fullWidth={false}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  icon: { fontSize: 48, marginBottom: spacing.lg },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  btn: { marginTop: spacing.sm },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '../../../src/components/ui/theme';
import Card from '../../../src/components/ui/Card';

function ToggleRow({ label, subtitle, value, onChange }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {subtitle && <Text style={styles.toggleSub}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: `${colors.primary}66` }}
        thumbColor={value ? colors.primary : colors.textMuted}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const [salePush, setSalePush]         = useState(true);
  const [inventoryPush, setInventory]   = useState(true);
  const [returnDeadline, setReturn]     = useState(true);
  const [sessionExpiry, setSession]     = useState(false);
  const [weeklyReport, setWeekly]       = useState(true);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Control which alerts you receive from Orben.
        </Text>

        <Text style={styles.groupLabel}>Sales</Text>
        <Card padded={false} style={styles.group}>
          <ToggleRow
            label="Sale Confirmed"
            subtitle="Get notified when a sale is recorded"
            value={salePush}
            onChange={setSalePush}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Weekly Sales Report"
            subtitle="Summary of your sales each week"
            value={weeklyReport}
            onChange={setWeekly}
          />
        </Card>

        <Text style={styles.groupLabel}>Inventory</Text>
        <Card padded={false} style={styles.group}>
          <ToggleRow
            label="Low Stock Alert"
            subtitle="When items are running low"
            value={inventoryPush}
            onChange={setInventory}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Return Deadline"
            subtitle="Remind me before return windows close"
            value={returnDeadline}
            onChange={setReturn}
          />
        </Card>

        <Text style={styles.groupLabel}>Marketplaces</Text>
        <Card padded={false} style={styles.group}>
          <ToggleRow
            label="Session Expiry Warning"
            subtitle="Alert when Mercari session is getting stale"
            value={sessionExpiry}
            onChange={setSession}
          />
        </Card>

        <Text style={styles.note}>
          Push notification settings are saved locally. Full notification control is available in the web app.
        </Text>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgCard,
  },
  headerTitle: { ...typography.h4, color: colors.textPrimary },
  backText: { ...typography.body, color: colors.primary },

  scroll: { padding: spacing.lg },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },

  groupLabel: {
    ...typography.label, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.md,
  },
  group: { marginBottom: spacing.sm, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  toggleInfo: { flex: 1, marginRight: spacing.md },
  toggleLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  toggleSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  note: {
    ...typography.caption, color: colors.textMuted, textAlign: 'center',
    lineHeight: 18, marginTop: spacing.xl, paddingHorizontal: spacing.xl,
  },
});

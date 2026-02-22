import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '../../../src/components/ui/theme';
import Card from '../../../src/components/ui/Card';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

function SettingRow({ icon, label, subtitle, onPress, rightLabel, chevron = true, danger = false }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowEmoji}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.rowRight}>
        {rightLabel && <Text style={styles.rightLabel}>{rightLabel}</Text>}
        {chevron && <Text style={styles.chevron}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const [user, setUser]       = useState(null);
  const [mercari, setMercari] = useState(null);

  useFocusEffect(useCallback(() => {
    getApi().then(async a => {
      const [sess, merc] = await Promise.all([
        a.supabase.auth.getSession(),
        a.getMercariSession().catch(() => null),
      ]);
      setUser(sess?.data?.session?.user ?? null);
      setMercari(merc);
    }).catch(() => {});
  }, []));

  const email     = user?.email || '';
  const firstName = user?.user_metadata?.first_name || email.split('@')[0] || 'User';

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          const a = await getApi();
          await a.supabase.auth.signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }

  const mercariStatus = mercari?.isValid
    ? (mercari.isStale ? 'Stale — reconnect' : 'Connected')
    : 'Not connected';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile Summary */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/(tabs)/settings/account')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{firstName}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Account */}
        <Text style={styles.groupLabel}>Account</Text>
        <Card padded={false} style={styles.group}>
          <SettingRow
            icon="👤" label="Profile" subtitle="Edit name, photo"
            onPress={() => router.push('/(tabs)/settings/account')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🔔" label="Notifications"
            onPress={() => router.push('/(tabs)/settings/notifications')}
          />
        </Card>

        {/* Marketplaces */}
        <Text style={styles.groupLabel}>Marketplaces</Text>
        <Card padded={false} style={styles.group}>
          <SettingRow
            icon="🛍️" label="Mercari"
            subtitle={mercariStatus}
            rightLabel={mercari?.isValid ? (mercari.isStale ? '⚠️' : '✓') : ''}
            onPress={() => router.push('/(tabs)/settings/marketplaces')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🛒" label="eBay"
            subtitle="Connect your eBay account"
            onPress={() => router.push('/(tabs)/settings/marketplaces')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="👥" label="Facebook Marketplace"
            subtitle="Connect your Facebook account"
            onPress={() => router.push('/(tabs)/settings/marketplaces')}
          />
        </Card>

        {/* App */}
        <Text style={styles.groupLabel}>App</Text>
        <Card padded={false} style={styles.group}>
          <SettingRow
            icon="🌐" label="Open Web App"
            subtitle="profitorbit.io"
            onPress={() => {
              const { Linking } = require('react-native');
              Linking.openURL('https://profitorbit.io');
            }}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="❓" label="Help & FAQ"
            onPress={() => {
              const { Linking } = require('react-native');
              Linking.openURL('https://profitorbit.io/faq');
            }}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🔒" label="Privacy Policy"
            onPress={() => {
              const { Linking } = require('react-native');
              Linking.openURL('https://profitorbit.io/privacy-policy');
            }}
          />
        </Card>

        {/* Sign Out */}
        <Card padded={false} style={[styles.group, { marginTop: spacing.xl }]}>
          <SettingRow icon="🚪" label="Sign Out" onPress={handleSignOut} danger chevron={false} />
        </Card>

        <Text style={styles.versionText}>Orben v1.0.0</Text>
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xl },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.xl,
    ...shadow.sm,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.textInverse },
  profileInfo: { flex: 1 },
  profileName: { ...typography.h4, color: colors.textPrimary },
  profileEmail: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

  groupLabel: {
    ...typography.label, color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  group: { marginBottom: spacing.sm, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowEmoji: { fontSize: 18 },
  rowContent: { flex: 1 },
  rowLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  rowSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rightLabel: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  chevron: { fontSize: 18, color: colors.textMuted, fontWeight: '300' },

  versionText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
});

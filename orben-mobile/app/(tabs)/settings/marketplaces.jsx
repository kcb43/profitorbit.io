import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '../../../src/components/ui/theme';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import Badge from '../../../src/components/ui/Badge';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

function MarketplaceCard({ icon, name, color, status, statusVariant, badgeLabel, children }) {
  return (
    <Card style={styles.mktCard} elevated>
      <View style={styles.mktHeader}>
        <View style={[styles.mktIcon, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
          <Text style={styles.mktEmoji}>{icon}</Text>
        </View>
        <View style={styles.mktInfo}>
          <Text style={styles.mktName}>{name}</Text>
          <Text style={[styles.mktStatus, { color: statusVariant === 'success' ? colors.primary : statusVariant === 'warning' ? colors.warning : colors.textMuted }]}>
            {status}
          </Text>
        </View>
        {badgeLabel && <Badge label={badgeLabel} variant={statusVariant} size="md" />}
      </View>
      {children}
    </Card>
  );
}

export default function MarketplacesScreen() {
  const [mercari, setMercari] = useState(null);

  useFocusEffect(useCallback(() => {
    getApi().then(a => a.getMercariSession()).then(setMercari).catch(() => setMercari(null));
  }, []));

  async function handleClearMercari() {
    Alert.alert('Disconnect Mercari', 'Remove your Mercari session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          const a = await getApi();
          await a.clearMercariSession();
          setMercari(null);
        },
      },
    ]);
  }

  const mercariConnected = mercari?.isValid;
  const mercariStale     = mercari?.isStale;
  const mercariAgeHrs    = mercari?.ageHours || 0;

  const mercariStatusText = !mercariConnected
    ? 'Not connected'
    : mercariStale
    ? `Connected (${mercariAgeHrs}h ago — refresh recommended)`
    : `Connected · Session active`;

  const mercariVariant = !mercariConnected ? 'muted' : mercariStale ? 'warning' : 'success';
  const mercariBadge   = !mercariConnected ? null : mercariStale ? '⚠ Stale' : '✓ Live';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplaces</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Connect your marketplace accounts to list items directly from Orben.
        </Text>

        {/* Mercari */}
        <MarketplaceCard
          icon="🏪"
          name="Mercari"
          color={colors.mercari}
          status={mercariStatusText}
          statusVariant={mercariVariant}
          badgeLabel={mercariBadge}
        >
          <View style={styles.mktActions}>
            {mercariConnected && (
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionInfoText}>
                  Session age: {mercariAgeHrs < 1 ? 'Just connected' : `${mercariAgeHrs} hours`}
                </Text>
                {mercariStale && (
                  <Text style={styles.sessionWarning}>
                    Sessions older than 23 hours may be expired. Reconnect for best results.
                  </Text>
                )}
              </View>
            )}

            {!mercariConnected && (
              <Text style={styles.mktExplain}>
                Log in to Mercari inside the app to enable server-side listing from your inventory.
              </Text>
            )}

            <Button
              onPress={() => router.push('/mercari-connect')}
              variant={mercariConnected ? 'secondary' : 'primary'}
              size="sm"
              fullWidth={false}
              style={styles.connectBtn}
            >
              {mercariConnected ? (mercariStale ? 'Refresh Session' : 'Reconnect') : 'Connect Mercari'}
            </Button>

            {mercariConnected && (
              <TouchableOpacity onPress={handleClearMercari} style={styles.disconnectBtn}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        </MarketplaceCard>

        {/* eBay */}
        <MarketplaceCard
          icon="🛒"
          name="eBay"
          color={colors.ebay}
          status="Connect via web app"
          statusVariant="muted"
        >
          <View style={styles.mktActions}>
            <Text style={styles.mktExplain}>
              eBay connection requires the Chrome extension. Open profitorbit.io on desktop to connect.
            </Text>
            <Button
              onPress={() => {
                const { Linking } = require('react-native');
                Linking.openURL('https://profitorbit.io/settings/marketplaces');
              }}
              variant="secondary"
              size="sm"
              fullWidth={false}
              style={styles.connectBtn}
            >
              Open Web App →
            </Button>
          </View>
        </MarketplaceCard>

        {/* Facebook Marketplace */}
        <MarketplaceCard
          icon="👥"
          name="Facebook Marketplace"
          color={colors.facebook}
          status="Connect via web app"
          statusVariant="muted"
        >
          <View style={styles.mktActions}>
            <Text style={styles.mktExplain}>
              Facebook Marketplace connection requires the Chrome extension. Open profitorbit.io on desktop to connect.
            </Text>
            <Button
              onPress={() => {
                const { Linking } = require('react-native');
                Linking.openURL('https://profitorbit.io/settings/marketplaces');
              }}
              variant="secondary"
              size="sm"
              fullWidth={false}
              style={styles.connectBtn}
            >
              Open Web App →
            </Button>
          </View>
        </MarketplaceCard>

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

  mktCard: { marginBottom: spacing.md },
  mktHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  mktIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    marginRight: spacing.md,
  },
  mktEmoji: { fontSize: 24 },
  mktInfo: { flex: 1 },
  mktName: { ...typography.h4, color: colors.textPrimary },
  mktStatus: { ...typography.caption, marginTop: 2 },
  mktActions: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  mktExplain: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },

  sessionInfo: { marginBottom: spacing.md },
  sessionInfoText: { ...typography.bodySmall, color: colors.textSecondary },
  sessionWarning: { ...typography.bodySmall, color: colors.warning, marginTop: spacing.xs, lineHeight: 18 },

  connectBtn: { alignSelf: 'flex-start' },
  disconnectBtn: { marginTop: spacing.sm },
  disconnectText: { ...typography.bodySmall, color: colors.danger },
});

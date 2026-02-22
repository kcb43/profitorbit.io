import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '../../../src/components/ui/theme';
import Badge from '../../../src/components/ui/Badge';
import EmptyState from '../../../src/components/ui/EmptyState';
import Card from '../../../src/components/ui/Card';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

function getThumb(item) {
  const raw = item.photos || item.images || (item.image_url ? [item.image_url] : null) || item.image_urls || [];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return null;
  if (typeof first === 'string') return first;
  return first?.url || first?.preview || first?.signedUrl || null;
}

const PLATFORMS = [
  { key: 'mercari', label: 'Mercari', color: colors.mercari, icon: '🛍️', field: 'mercari_listing_id' },
  { key: 'ebay',    label: 'eBay',    color: colors.ebay,    icon: '🛒', field: 'ebay_listing_id' },
  { key: 'facebook',label: 'FB',      color: colors.facebook, icon: '👥', field: 'facebook_listing_id' },
];

export default function CrosslistScreen() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mercari, setMercari] = useState(null);
  const [tab, setTab]         = useState('unlisted'); // 'unlisted' | 'all'

  const loadData = useCallback(async () => {
    try {
      const a = await getApi();
      const [inv, merc] = await Promise.all([
        a.getInventoryItems('', 200).catch(() => []),
        a.getMercariSession().catch(() => null),
      ]);
      setItems(Array.isArray(inv) ? inv : inv?.items || []);
      setMercari(merc);
    } catch (e) {
      console.warn('Crosslist load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const filtered = items.filter(item => {
    if (item.status?.toLowerCase() === 'sold') return false;
    if (tab === 'unlisted') {
      return !item.mercari_listing_id && !item.ebay_listing_id && !item.facebook_listing_id &&
        !(item.marketplace_listings?.length > 0);
    }
    return true;
  });

  const unlistedCount = items.filter(i =>
    i.status?.toLowerCase() !== 'sold' &&
    !i.mercari_listing_id && !i.ebay_listing_id && !i.facebook_listing_id &&
    !(i.marketplace_listings?.length > 0)
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Crosslist</Text>
        {!mercari?.isValid && (
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={() => router.push('/mercari-connect')}
          >
            <Text style={styles.connectBtnText}>Connect Mercari</Text>
          </TouchableOpacity>
        )}
        {mercari?.isValid && (
          <Badge label="Mercari ✓" variant={mercari.isStale ? 'warning' : 'success'} size="md" />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabChip, tab === 'unlisted' && styles.tabChipActive]}
          onPress={() => setTab('unlisted')}
        >
          <Text style={[styles.tabText, tab === 'unlisted' && styles.tabTextActive]}>
            Ready to List {unlistedCount > 0 ? `(${unlistedCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabChip, tab === 'all' && styles.tabChipActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>All Items</Text>
        </TouchableOpacity>
      </View>

      {/* Mercari Connect Prompt */}
      {!mercari?.isValid && (
        <Card style={styles.connectPrompt} elevated>
          <Text style={styles.connectPromptIcon}>🔗</Text>
          <Text style={styles.connectPromptTitle}>Connect Mercari to Start Listing</Text>
          <Text style={styles.connectPromptText}>
            Log in to Mercari inside the app once to enable one-tap listing from your inventory.
          </Text>
          <TouchableOpacity style={styles.connectPromptBtn} onPress={() => router.push('/mercari-connect')}>
            <Text style={styles.connectPromptBtnText}>Connect Now →</Text>
          </TouchableOpacity>
        </Card>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <CrosslistCard item={item} mercari={mercari} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="🔄"
              title={tab === 'unlisted' ? 'All items are listed!' : 'No inventory yet'}
              subtitle={tab === 'unlisted'
                ? 'Great work — all your in-stock items have been crosslisted.'
                : 'Add items to your inventory first.'}
              actionLabel={tab === 'unlisted' ? 'View All Items' : 'Add Item'}
              onAction={() => tab === 'unlisted'
                ? setTab('all')
                : router.push('/(tabs)/inventory/add')
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function CrosslistCard({ item, mercari }) {
  const thumb  = getThumb(item);
  const name   = item.item_name || item.name || item.title || 'Untitled';
  const price  = item.listing_price || item.price;

  const onMercari  = !!item.mercari_listing_id;
  const onEbay     = !!item.ebay_listing_id;
  const onFacebook = !!item.facebook_listing_id;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={{ fontSize: 24 }}>📦</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{name}</Text>
          {price != null && <Text style={styles.cardPrice}>${Number(price).toFixed(2)}</Text>}
        </View>
      </View>

      {/* Platform status row */}
      <View style={styles.platformRow}>
        {PLATFORMS.map(p => (
          <View key={p.key} style={[styles.platPill, onMercari && p.key === 'mercari' && { borderColor: p.color },
            onEbay && p.key === 'ebay' && { borderColor: p.color },
            onFacebook && p.key === 'facebook' && { borderColor: p.color }]}>
            <Text style={styles.platIcon}>{p.icon}</Text>
            <Text style={[styles.platLabel, {
              color: (p.key === 'mercari' ? onMercari : p.key === 'ebay' ? onEbay : onFacebook) ? p.color : colors.textMuted,
            }]}>
              {p.label}
            </Text>
            <Text style={[styles.platCheck, {
              color: (p.key === 'mercari' ? onMercari : p.key === 'ebay' ? onEbay : onFacebook) ? p.color : colors.textMuted,
            }]}>
              {(p.key === 'mercari' ? onMercari : p.key === 'ebay' ? onEbay : onFacebook) ? '✓' : '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/(tabs)/inventory/${item.id}`)}
        >
          <Text style={styles.actionBtnText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => router.push({ pathname: '/(tabs)/crosslist/compose', params: { itemId: item.id } })}
        >
          <Text style={[styles.actionBtnText, { color: colors.textInverse }]}>
            {onMercari ? 'Edit Listing' : 'List Item'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  connectBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
  },
  connectBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  tabChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.textInverse },

  connectPrompt: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md, alignItems: 'center',
  },
  connectPromptIcon: { fontSize: 36, marginBottom: spacing.sm },
  connectPromptTitle: { ...typography.h4, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  connectPromptText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: spacing.md },
  connectPromptBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  connectPromptBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: 14 },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.bgInput, marginRight: spacing.md },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { ...typography.h4, color: colors.textPrimary, lineHeight: 19 },
  cardPrice: { ...typography.body, color: colors.primary, fontWeight: '700', marginTop: 4 },

  platformRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  platPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.xs, backgroundColor: colors.bgInput,
  },
  platIcon: { fontSize: 12 },
  platLabel: { fontSize: 10, fontWeight: '600' },
  platCheck: { fontSize: 11, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionBtnText: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
});

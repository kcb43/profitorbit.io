import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '../../../src/components/ui/theme';
import Badge from '../../../src/components/ui/Badge';
import EmptyState from '../../../src/components/ui/EmptyState';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

const FILTERS = ['All', 'In Stock', 'Listed', 'Sold'];

function statusVariant(s) {
  const lower = (s || '').toLowerCase();
  if (lower === 'sold') return 'danger';
  if (lower === 'listed') return 'info';
  return 'success';
}

function getThumb(item) {
  const raw = item.photos || item.images || (item.image_url ? [item.image_url] : null) || item.image_urls || [];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return null;
  if (typeof first === 'string') return first;
  return first?.url || first?.preview || first?.signedUrl || first?.publicUrl || null;
}

export default function InventoryScreen() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('All');

  const loadData = useCallback(async (q = search) => {
    try {
      const a = await getApi();
      const result = await a.getInventoryItems(q, 100);
      const arr = Array.isArray(result) ? result : result?.items || [];
      setItems(arr);
    } catch (e) {
      console.warn('Inventory load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const filtered = items.filter(item => {
    if (filter === 'All') return true;
    const s = (item.status || '').toLowerCase();
    if (filter === 'In Stock') return s === '' || s === 'in stock' || s === 'available';
    if (filter === 'Listed') return s === 'listed';
    if (filter === 'Sold') return s === 'sold';
    return true;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(tabs)/inventory/add')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadData(search)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <InventoryCard item={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="📦"
              title="No items found"
              subtitle={filter !== 'All' ? `No items with status "${filter}"` : 'Add your first inventory item to get started.'}
              actionLabel="Add Item"
              onAction={() => router.push('/(tabs)/inventory/add')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function InventoryCard({ item }) {
  const thumb = getThumb(item);
  const name  = item.item_name || item.name || item.title || 'Untitled';
  const price = item.listing_price || item.price;
  const status = item.status || 'In Stock';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/inventory/${item.id}`)}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={{ fontSize: 26 }}>📦</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
        <View style={styles.metaRow}>
          {item.brand ? <Text style={styles.metaText}>{item.brand}</Text> : null}
          {item.condition ? <Text style={styles.metaText}>{item.condition}</Text> : null}
        </View>
        <View style={styles.bottomRow}>
          {price != null && <Text style={styles.price}>${Number(price).toFixed(2)}</Text>}
          <Badge label={status} variant={statusVariant(status)} size="sm" />
        </View>
      </View>

      {/* Platform dots */}
      <View style={styles.platforms}>
        {(item.marketplace_listings || []).map((ml, i) => (
          <View key={i} style={[styles.platDot, { backgroundColor: platformColor(ml.platform || ml.marketplace) }]} />
        ))}
        {item.ebay_listing_id    && <View style={[styles.platDot, { backgroundColor: colors.ebay }]} />}
        {item.mercari_listing_id && <View style={[styles.platDot, { backgroundColor: colors.mercari }]} />}
        {item.facebook_listing_id && <View style={[styles.platDot, { backgroundColor: colors.facebook }]} />}
      </View>
    </TouchableOpacity>
  );
}

function platformColor(p) {
  const lower = (p || '').toLowerCase();
  if (lower.includes('mercari')) return colors.mercari;
  if (lower.includes('ebay')) return colors.ebay;
  if (lower.includes('facebook') || lower.includes('fb')) return colors.facebook;
  return colors.textMuted;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  addBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: 14 },

  searchRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: { fontSize: 14, marginRight: spacing.xs },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 10 },

  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textInverse },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, marginBottom: spacing.sm,
    ...shadow.sm,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.bgInput },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  info: { flex: 1, paddingHorizontal: spacing.md },
  itemName: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.xs, lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  price: { ...typography.body, color: colors.primary, fontWeight: '700' },

  platforms: { flexDirection: 'column', gap: 4, marginLeft: spacing.xs },
  platDot: { width: 8, height: 8, borderRadius: 4 },
});

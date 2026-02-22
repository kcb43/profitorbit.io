import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
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

const PLATFORM_FILTERS = ['All', 'Mercari', 'eBay', 'Facebook', 'Other'];

function platVariant(p) {
  const l = (p || '').toLowerCase();
  if (l.includes('mercari')) return 'mercari';
  if (l.includes('ebay'))    return 'ebay';
  if (l.includes('facebook') || l.includes('fb')) return 'facebook';
  return 'muted';
}

function groupByMonth(sales) {
  const groups = {};
  for (const s of sales) {
    const date = s.sale_date || s.sold_at || s.created_at;
    const key  = date
      ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      : 'Unknown Date';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function SalesScreen() {
  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('All');
  const [summary, setSummary]     = useState(null);

  const loadData = useCallback(async () => {
    try {
      const a = await getApi();
      const [salesData, sum] = await Promise.all([
        a.getSales({ limit: 200 }).catch(() => []),
        a.getSalesSummary().catch(() => null),
      ]);
      setSales(Array.isArray(salesData) ? salesData : salesData?.sales || []);
      setSummary(sum);
    } catch (e) {
      console.warn('Sales load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const filtered = sales.filter(s => {
    if (filter === 'All') return true;
    const p = (s.platform || s.marketplace || '').toLowerCase();
    if (filter === 'Mercari')  return p.includes('mercari');
    if (filter === 'eBay')     return p.includes('ebay');
    if (filter === 'Facebook') return p.includes('facebook') || p.includes('fb');
    if (filter === 'Other')    return !p.includes('mercari') && !p.includes('ebay') && !p.includes('facebook');
    return true;
  });

  const sections = groupByMonth(filtered);

  const totalRevenue = filtered.reduce((sum, s) => sum + (Number(s.sale_price ?? s.price ?? 0)), 0);
  const totalProfit  = filtered.reduce((sum, s) => sum + (Number(s.profit ?? s.net_profit ?? 0)), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sales</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(tabs)/sales/add')}>
          <Text style={styles.addBtnText}>+ Record</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Strip */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${Number(summary.total_revenue ?? totalRevenue).toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
            <Text style={styles.summaryLabel}>Revenue</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              ${Number(summary.total_profit ?? totalProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.summaryLabel}>Profit</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.total_sales ?? filtered.length}</Text>
            <Text style={styles.summaryLabel}>Sales</Text>
          </View>
        </View>
      )}

      {/* Platform Filter */}
      <View style={styles.filterScroll}>
        {PLATFORM_FILTERS.map(f => (
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
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => String(item.id || i)}
          renderItem={({ item }) => <SaleCard sale={item} />}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} data={section.data} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={sections.length === 0 ? { flex: 1 } : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="💰"
              title="No sales yet"
              subtitle="Record a sale when you sell an item to track your profits."
              actionLabel="Record Sale"
              onAction={() => router.push('/(tabs)/sales/add')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function SectionHeader({ title, data }) {
  const monthRevenue = data.reduce((s, sale) => s + Number(sale.sale_price ?? sale.price ?? 0), 0);
  const monthProfit  = data.reduce((s, sale) => s + Number(sale.profit ?? sale.net_profit ?? 0), 0);

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionMeta}>
        <Text style={styles.sectionRevenue}>${monthRevenue.toFixed(0)}</Text>
        {monthProfit !== 0 && (
          <Text style={[styles.sectionProfit, { color: monthProfit >= 0 ? colors.primary : colors.danger }]}>
            {monthProfit >= 0 ? '+' : ''}${monthProfit.toFixed(0)} profit
          </Text>
        )}
      </View>
    </View>
  );
}

function SaleCard({ sale }) {
  const name     = sale.item_name || sale.name || sale.title || 'Item';
  const price    = sale.sale_price ?? sale.price ?? sale.amount ?? null;
  const profit   = sale.profit ?? sale.net_profit ?? null;
  const platform = sale.platform || sale.marketplace || '';
  const date     = sale.sale_date || sale.sold_at || sale.created_at;
  const dateStr  = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
        <View style={styles.cardMeta}>
          {platform ? <Badge label={platform} variant={platVariant(platform)} size="sm" /> : null}
          {dateStr ? <Text style={styles.cardDate}>{dateStr}</Text> : null}
        </View>
      </View>
      <View style={styles.cardRight}>
        {price != null && <Text style={styles.cardPrice}>${Number(price).toFixed(2)}</Text>}
        {profit != null && (
          <Text style={[styles.cardProfit, { color: Number(profit) >= 0 ? colors.primary : colors.danger }]}>
            {Number(profit) >= 0 ? '+' : ''}${Number(profit).toFixed(2)}
          </Text>
        )}
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
  addBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  addBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: 14 },

  summaryRow: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, ...shadow.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
  summaryLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  filterScroll: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textInverse },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, marginTop: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  sectionTitle: { ...typography.h4, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionMeta: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  sectionRevenue: { ...typography.bodySmall, color: colors.textMuted },
  sectionProfit: { ...typography.bodySmall, fontWeight: '700' },

  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.sm,
  },
  cardLeft: { flex: 1, marginRight: spacing.sm },
  cardName: { ...typography.body, color: colors.textPrimary, fontWeight: '500', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardDate: { ...typography.caption, color: colors.textMuted },
  cardRight: { alignItems: 'flex-end' },
  cardPrice: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  cardProfit: { ...typography.bodySmall, fontWeight: '700', marginTop: 2 },
});

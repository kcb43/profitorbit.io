import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '../../src/components/ui/theme';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';

let api = null;
async function getApi() {
  if (!api) api = await import('../../src/services/orbenApi');
  return api;
}

function fmt(n, prefix = '') {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  if (Math.abs(num) >= 1000) return `${prefix}${(num / 1000).toFixed(1)}k`;
  return `${prefix}${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
}

function fmtCurrency(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function DashboardScreen() {
  const [user, setUser]               = useState(null);
  const [summary, setSummary]         = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [mercari, setMercari]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const loadData = useCallback(async () => {
    try {
      const a = await getApi();
      const [s, sales, merc, session] = await Promise.all([
        a.getSalesSummary().catch(() => null),
        a.getRecentSales(5).catch(() => []),
        a.getMercariSession().catch(() => null),
        a.supabase.auth.getSession().catch(() => null),
      ]);
      setSummary(s);
      setRecentSales(Array.isArray(sales) ? sales : sales?.sales || []);
      setMercari(merc);
      setUser(session?.data?.session?.user ?? null);
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'there';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const profit    = summary?.total_profit ?? summary?.profit_30d ?? null;
  const salesCnt  = summary?.total_sales  ?? summary?.sales_count ?? null;
  const inStock   = summary?.items_in_stock ?? summary?.inventory_count ?? null;
  const revenue   = summary?.total_revenue ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()}, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>Here's your business overview</Text>
          </View>
          {mercari?.isValid && (
            <Badge
              label={mercari.isStale ? 'Mercari ⚠' : 'Mercari ✓'}
              variant={mercari.isStale ? 'warning' : 'success'}
              size="md"
            />
          )}
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <KPICard
            label="30-Day Profit"
            value={fmtCurrency(profit)}
            icon="📈"
            accent={colors.primary}
            onPress={() => router.push('/(tabs)/sales')}
          />
          <KPICard
            label="Total Sales"
            value={fmt(salesCnt)}
            icon="🏷️"
            accent={colors.info}
            onPress={() => router.push('/(tabs)/sales')}
          />
          <KPICard
            label="In Stock"
            value={fmt(inStock)}
            icon="📦"
            accent="#9333ea"
            onPress={() => router.push('/(tabs)/inventory')}
          />
          {revenue != null && (
            <KPICard
              label="Revenue"
              value={fmtCurrency(revenue)}
              icon="💵"
              accent={colors.warning}
              onPress={() => router.push('/(tabs)/sales')}
            />
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <QuickAction
            icon="➕"
            label="Add Item"
            color={colors.info}
            onPress={() => router.push('/(tabs)/inventory/add')}
          />
          <QuickAction
            icon="💲"
            label="Record Sale"
            color={colors.primary}
            onPress={() => router.push('/(tabs)/sales/add')}
          />
          <QuickAction
            icon="🔄"
            label="Crosslist"
            color="#9333ea"
            onPress={() => router.push('/(tabs)/crosslist')}
          />
          <QuickAction
            icon="📊"
            label="Reports"
            color={colors.warning}
            onPress={() => router.push('/(tabs)/sales')}
          />
        </View>

        {/* Recent Sales */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sales</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
            <Text style={styles.sectionLink}>See All →</Text>
          </TouchableOpacity>
        </View>

        {recentSales.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏷️</Text>
            <Text style={styles.emptyTitle}>No sales yet</Text>
            <Text style={styles.emptyText}>Record your first sale to see it here.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/sales/add')}>
              <Text style={styles.emptyBtnText}>Record a Sale</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          recentSales.map((sale, i) => <SaleRow key={sale.id || i} sale={sale} />)
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({ label, value, icon, accent, onPress }) {
  return (
    <TouchableOpacity style={[styles.kpiCard, { borderLeftColor: accent }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
        <Text style={styles.actionEmoji}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SaleRow({ sale }) {
  const name  = sale.item_name || sale.name || sale.title || 'Item';
  const price = sale.sale_price ?? sale.price ?? sale.amount ?? null;
  const platform = sale.platform || sale.marketplace || '';
  const date  = sale.sale_date || sale.sold_at || sale.created_at;
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  const platVariant = platform.toLowerCase().includes('mercari') ? 'mercari'
    : platform.toLowerCase().includes('ebay') ? 'ebay'
    : platform.toLowerCase().includes('facebook') ? 'facebook'
    : 'muted';

  return (
    <Card style={styles.saleRow}>
      <View style={styles.saleLeft}>
        <Text style={styles.saleName} numberOfLines={1}>{name}</Text>
        <View style={styles.saleMeta}>
          {platform ? <Badge label={platform} variant={platVariant} size="sm" /> : null}
          {dateStr ? <Text style={styles.saleDate}>{dateStr}</Text> : null}
        </View>
      </View>
      <Text style={styles.salePrice}>{price != null ? `$${Number(price).toFixed(2)}` : '—'}</Text>
    </Card>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  greeting: { ...typography.h2, color: colors.textPrimary },
  subGreeting: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },

  sectionTitle: { ...typography.h4, color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionLink: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.md,
    ...shadow.sm,
  },
  kpiIcon: { fontSize: 20, marginBottom: spacing.xs },
  kpiValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  kpiLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  action: { alignItems: 'center', flex: 1 },
  actionIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: spacing.xs,
  },
  actionEmoji: { fontSize: 24 },
  actionLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },

  saleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  saleLeft: { flex: 1, marginRight: spacing.sm },
  saleName: { ...typography.body, color: colors.textPrimary, fontWeight: '500', marginBottom: 4 },
  saleMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saleDate: { ...typography.caption, color: colors.textMuted },
  salePrice: { ...typography.body, color: colors.primary, fontWeight: '700' },

  emptyCard: { alignItems: 'center', padding: spacing.xxl, marginBottom: spacing.md },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  emptyBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: 14 },
});

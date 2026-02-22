import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Dimensions, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, spacing, typography, radius, shadow } from '../../../src/components/ui/theme';
import Card from '../../../src/components/ui/Card';
import Badge from '../../../src/components/ui/Badge';
import Button from '../../../src/components/ui/Button';

const { width: SCREEN_W } = Dimensions.get('window');

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

function getPhotos(item) {
  const raw = item.photos || item.images || (item.image_url ? [item.image_url] : null) || item.image_urls || [];
  return (Array.isArray(raw) ? raw : [raw])
    .map(p => (typeof p === 'string' ? p : p?.url || p?.preview || p?.signedUrl || p?.publicUrl))
    .filter(Boolean);
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const [item, setItem]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [listing, setListing]   = useState(false);
  const [mercari, setMercari]   = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  const loadItem = useCallback(async () => {
    try {
      const a = await getApi();
      const [it, merc] = await Promise.all([
        a.getInventoryItem(id),
        a.getMercariSession().catch(() => null),
      ]);
      setItem(it);
      setMercari(merc);
    } catch (e) {
      Alert.alert('Error', 'Could not load item.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadItem(); }, [loadItem]));

  async function handleListMercari() {
    if (!mercari?.isValid) {
      Alert.alert('Connect Mercari First', 'Go to Settings → Marketplaces to connect your Mercari account.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings/marketplaces') },
      ]);
      return;
    }
    const photos = getPhotos(item);
    if (!photos.length) {
      Alert.alert('No Images', 'This item has no photos. Please add at least one image first.');
      return;
    }
    setListing(true);
    try {
      const a = await getApi();
      const result = await a.createMercariListingServerSide({
        title:       item.item_name || item.name || item.title,
        description: item.description || item.notes || '',
        price:       item.listing_price || item.price,
        images:      photos,
        condition:   item.condition || 'Good',
        zipCode:     item.zip_code || item.zipCode,
      });
      if (result.success) {
        Alert.alert('Listed on Mercari! 🎉', result.url || 'Your item is now live on Mercari.', [
          { text: 'View Listing', onPress: () => result.url && Linking.openURL(result.url) },
          { text: 'Done', style: 'cancel' },
        ]);
        loadItem();
      } else {
        const isExpired = result.errorType === 'session_expired';
        Alert.alert('Listing Failed', result.error || 'Unknown error.', [
          isExpired
            ? { text: 'Reconnect', onPress: () => router.push('/mercari-connect') }
            : { text: 'OK' },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setListing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!item) return null;

  const photos = getPhotos(item);
  const name   = item.item_name || item.name || item.title || 'Untitled';
  const isOnMercari = !!(item.mercari_listing_id);
  const isOnEbay    = !!(item.ebay_listing_id);
  const isOnFB      = !!(item.facebook_listing_id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Back */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(tabs)/inventory/add', params: { editId: item.id } })}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Photo Carousel */}
        {photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onScroll={e => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              scrollEventThrottle={16}
            >
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View style={styles.photoDots}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === photoIdx && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={{ fontSize: 60 }}>📦</Text>
            <Text style={styles.noPhotoText}>No photos</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title + Price */}
          <Text style={styles.name}>{name}</Text>
          <View style={styles.priceRow}>
            {item.listing_price != null && (
              <Text style={styles.price}>${Number(item.listing_price).toFixed(2)}</Text>
            )}
            {item.purchase_price != null && (
              <Text style={styles.costText}>Cost: ${Number(item.purchase_price).toFixed(2)}</Text>
            )}
            <Badge label={item.status || 'In Stock'} variant={statusVariant(item.status)} size="md" />
          </View>

          {/* Marketplace Status */}
          <Card style={styles.platformCard}>
            <Text style={styles.cardSectionTitle}>Listed On</Text>
            <View style={styles.platforms}>
              <PlatformStatus label="Mercari" active={isOnMercari} color={colors.mercari}
                onPress={isOnMercari ? () => {} : handleListMercari} />
              <PlatformStatus label="eBay" active={isOnEbay} color={colors.ebay} />
              <PlatformStatus label="Facebook" active={isOnFB} color={colors.facebook} />
            </View>
            {!isOnMercari && mercari?.isValid && (
              <Button
                onPress={handleListMercari}
                loading={listing}
                variant="secondary"
                size="sm"
                style={{ marginTop: spacing.md }}
              >
                List on Mercari
              </Button>
            )}
            {!mercari?.isValid && (
              <TouchableOpacity
                style={styles.connectHint}
                onPress={() => router.push('/(tabs)/settings/marketplaces')}
              >
                <Text style={styles.connectHintText}>Connect Mercari to list →</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Details */}
          <Card style={styles.detailsCard}>
            <Text style={styles.cardSectionTitle}>Item Details</Text>
            <InfoRow label="Brand"       value={item.brand} />
            <InfoRow label="Condition"   value={item.condition} />
            <InfoRow label="Category"    value={item.category} />
            <InfoRow label="Size"        value={item.size} />
            <InfoRow label="Color"       value={[item.color1, item.color2].filter(Boolean).join(', ') || null} />
            <InfoRow label="SKU"         value={item.sku} />
            <InfoRow label="Source"      value={item.source} />
            <InfoRow label="Purchase Date" value={fmtDate(item.purchase_date)} />
            <InfoRow label="Listed Price" value={item.listing_price != null ? `$${Number(item.listing_price).toFixed(2)}` : null} />
            <InfoRow label="Purchase Price" value={item.purchase_price != null ? `$${Number(item.purchase_price).toFixed(2)}` : null} />
            {item.listing_price && item.purchase_price && (
              <InfoRow
                label="Potential Profit"
                value={`$${(Number(item.listing_price) - Number(item.purchase_price)).toFixed(2)}`}
              />
            )}
          </Card>

          {/* Description */}
          {item.description ? (
            <Card style={styles.detailsCard}>
              <Text style={styles.cardSectionTitle}>Description</Text>
              <Text style={styles.descText}>{item.description}</Text>
            </Card>
          ) : null}

          {/* Notes */}
          {item.notes ? (
            <Card style={styles.detailsCard}>
              <Text style={styles.cardSectionTitle}>Notes</Text>
              <Text style={styles.descText}>{item.notes}</Text>
            </Card>
          ) : null}

          {/* Tags */}
          {item.internal_tags?.length > 0 || item.listing_keywords?.length > 0 ? (
            <Card style={styles.detailsCard}>
              <Text style={styles.cardSectionTitle}>Tags</Text>
              <View style={styles.tagRow}>
                {[...(item.internal_tags || []), ...(item.listing_keywords || [])].map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Crosslist CTA */}
          <Button
            onPress={() => router.push({ pathname: '/(tabs)/crosslist/compose', params: { itemId: item.id } })}
            variant="outline"
            style={{ marginTop: spacing.sm }}
          >
            Compose Listing
          </Button>

          <View style={{ height: spacing.xxxl }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlatformStatus({ label, active, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.platChip, { borderColor: active ? color : colors.border }]}
      onPress={onPress}
      disabled={!onPress || active}
      activeOpacity={0.7}
    >
      <View style={[styles.platDot, { backgroundColor: active ? color : colors.textMuted }]} />
      <Text style={[styles.platLabel, active && { color }]}>{label}</Text>
      <Text style={[styles.platStatus, { color: active ? color : colors.textMuted }]}>
        {active ? '✓' : '—'}
      </Text>
    </TouchableOpacity>
  );
}

function statusVariant(s) {
  const lower = (s || '').toLowerCase();
  if (lower === 'sold') return 'danger';
  if (lower === 'listed') return 'info';
  return 'success';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing.xxxl },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  backText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  editText: { ...typography.body, color: colors.primary, fontWeight: '600' },

  photo: { width: SCREEN_W, height: SCREEN_W * 0.75 },
  photoDots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 16 },

  photoPlaceholder: {
    height: 220, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  noPhotoText: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm },

  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  name: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, flexWrap: 'wrap' },
  price: { fontSize: 26, fontWeight: '800', color: colors.primary },
  costText: { ...typography.body, color: colors.textMuted },

  platformCard: { marginBottom: spacing.md },
  cardSectionTitle: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.md },

  platforms: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  platChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  platDot: { width: 8, height: 8, borderRadius: 4 },
  platLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  platStatus: { ...typography.bodySmall, fontWeight: '700' },

  connectHint: { marginTop: spacing.sm },
  connectHintText: { ...typography.bodySmall, color: colors.primary },

  detailsCard: { marginBottom: spacing.md },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.bodySmall, color: colors.textMuted },
  infoValue: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: spacing.md },

  descText: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    backgroundColor: colors.bgInput, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  tagText: { ...typography.caption, color: colors.textSecondary },
});

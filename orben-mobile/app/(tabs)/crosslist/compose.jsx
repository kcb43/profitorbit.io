import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, radius } from '../../../src/components/ui/theme';
import Button from '../../../src/components/ui/Button';
import Input from '../../../src/components/ui/Input';
import Card from '../../../src/components/ui/Card';
import Badge from '../../../src/components/ui/Badge';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

function getPhotos(item) {
  const raw = item.photos || item.images || (item.image_url ? [item.image_url] : null) || item.image_urls || [];
  return (Array.isArray(raw) ? raw : [raw])
    .map(p => (typeof p === 'string' ? p : p?.url || p?.preview || p?.signedUrl))
    .filter(Boolean);
}

const PLATFORM_OPTIONS = [
  { key: 'mercari', label: 'Mercari', color: colors.mercari, icon: '🛍️' },
];

export default function ComposeScreen() {
  const { itemId } = useLocalSearchParams();

  const [item, setItem]       = useState(null);
  const [mercari, setMercari] = useState(null);
  const [loading, setLoading] = useState(!!itemId);
  const [listing, setListing] = useState(false);

  const [platform, setPlatform]   = useState('mercari');
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [price, setPrice]         = useState('');
  const [condition, setCondition] = useState('Good');
  const [photos, setPhotos]       = useState([]);

  useEffect(() => {
    if (!itemId) { setLoading(false); return; }
    getApi().then(async a => {
      const [it, merc] = await Promise.all([
        a.getInventoryItem(itemId),
        a.getMercariSession().catch(() => null),
      ]);
      setItem(it);
      setMercari(merc);
      setTitle(it.item_name || it.name || '');
      setDesc(it.description || it.notes || '');
      setPrice(String(it.listing_price || it.price || ''));
      setCondition(it.condition || 'Good');
      setPhotos(getPhotos(it));
    }).catch(e => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, [itemId]);

  const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  async function handleList() {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!price || parseFloat(price) <= 0) { Alert.alert('Required', 'Please enter a valid price.'); return; }
    if (!photos.length) { Alert.alert('No Photos', 'This item has no photos. Add photos via Inventory first.'); return; }

    if (platform === 'mercari') {
      if (!mercari?.isValid) {
        Alert.alert('Connect Mercari', 'Please connect your Mercari account in Settings → Marketplaces first.', [
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings/marketplaces') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      setListing(true);
      try {
        const a = await getApi();
        const result = await a.createMercariListingServerSide({
          title:       title.trim(),
          description: description.trim(),
          price:       parseFloat(price),
          images:      photos,
          condition,
          zipCode:     item?.zip_code || item?.zipCode,
        });
        if (result.success) {
          Alert.alert('Listed on Mercari! 🎉', result.url || 'Your item is now live.', [
            { text: 'View Listing', onPress: () => result.url && Linking.openURL(result.url) },
            { text: 'Done', onPress: () => router.back() },
          ]);
        } else {
          const expired = result.errorType === 'session_expired';
          Alert.alert('Listing Failed', result.error || 'Unknown error.', [
            expired
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
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Compose Listing</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Platform Selector */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Platform</Text>
            <View style={styles.platformRow}>
              {PLATFORM_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.platBtn, platform === p.key && { borderColor: p.color, backgroundColor: `${p.color}18` }]}
                  onPress={() => setPlatform(p.key)}
                >
                  <Text style={styles.platIcon}>{p.icon}</Text>
                  <Text style={[styles.platLabel, platform === p.key && { color: p.color }]}>{p.label}</Text>
                  {mercari?.isValid && p.key === 'mercari' && (
                    <Badge label={mercari.isStale ? '⚠ Stale' : '✓ Live'} variant={mercari.isStale ? 'warning' : 'success'} size="sm" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Coming Soon */}
              {[{ key: 'ebay', label: 'eBay', icon: '🛒' }, { key: 'facebook', label: 'FB', icon: '👥' }].map(p => (
                <View key={p.key} style={[styles.platBtn, styles.platBtnDisabled]}>
                  <Text style={styles.platIcon}>{p.icon}</Text>
                  <Text style={styles.platLabelDisabled}>{p.label}</Text>
                  <Text style={styles.comingSoon}>Soon</Text>
                </View>
              ))}
            </View>

            {!mercari?.isValid && platform === 'mercari' && (
              <TouchableOpacity
                style={styles.connectHint}
                onPress={() => router.push('/(tabs)/settings/marketplaces')}
              >
                <Text style={styles.connectHintText}>⚠ Connect Mercari to enable listing →</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Photos Preview */}
          {photos.length > 0 && (
            <Card style={styles.section} padded={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                ))}
              </ScrollView>
              <Text style={styles.photoCount}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
            </Card>
          )}

          {/* Listing Form */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Listing Details</Text>
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Item title…"
              returnKeyType="next"
            />
            <Input
              label="Price"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Text style={[styles.sectionTitle, { marginTop: spacing.sm, marginBottom: spacing.sm }]}>Condition</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {CONDITIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.condChip, condition === c && styles.condChipActive]}
                  onPress={() => setCondition(c)}
                >
                  <Text style={[styles.condChipText, condition === c && styles.condChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Input
              label="Description"
              value={description}
              onChangeText={setDesc}
              placeholder="Describe the item for buyers…"
              multiline
              numberOfLines={5}
            />
          </Card>

          {/* List Button */}
          <Button onPress={handleList} loading={listing}>
            {listing ? 'Listing…' : `List on ${PLATFORM_OPTIONS.find(p => p.key === platform)?.label || 'Marketplace'}`}
          </Button>

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgCard,
  },
  headerTitle: { ...typography.h4, color: colors.textPrimary },
  cancel: { ...typography.body, color: colors.primary },

  scroll: { padding: spacing.lg, gap: spacing.md },
  section: { marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },

  platformRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  platBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bgInput,
  },
  platBtnDisabled: { opacity: 0.4 },
  platIcon: { fontSize: 16 },
  platLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  platLabelDisabled: { ...typography.bodySmall, color: colors.textMuted },
  comingSoon: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },

  connectHint: { marginTop: spacing.md },
  connectHintText: { ...typography.bodySmall, color: colors.warning },

  photoScroll: { padding: spacing.sm },
  photoThumb: { width: 80, height: 80, borderRadius: radius.md, marginRight: spacing.sm },
  photoCount: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },

  condChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgInput, marginRight: spacing.sm,
  },
  condChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  condChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '500' },
  condChipTextActive: { color: colors.textInverse, fontWeight: '700' },
});

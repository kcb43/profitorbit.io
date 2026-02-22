/**
 * Orben Mobile — Home Screen
 *
 * Shows inventory items and Mercari connection status.
 * Users can tap an item to list it on Mercari directly from their phone.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  getMercariSession,
  getInventoryItems,
  createMercariListingServerSide,
  supabase,
} from '../src/services/orbenApi';

export default function HomeScreen() {
  const [user, setUser]               = useState(null);
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [mercariSession, setMercariSession] = useState(null);
  const [listingItemId, setListingItemId]   = useState(null); // ID of item being listed

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [inv, session] = await Promise.all([
        getInventoryItems(search).catch(() => ({ items: [] })),
        getMercariSession(),
      ]);
      setItems(inv?.items || inv || []);
      setMercariSession(session);
    } catch (err) {
      console.warn('Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── List item on Mercari ──────────────────────────────────────────────────

  const handleListOnMercari = useCallback(async (item) => {
    if (!mercariSession?.isValid) {
      Alert.alert(
        'Connect Mercari First',
        'You need to connect your Mercari account before listing.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect Now', onPress: () => router.push('/mercari-connect') },
        ]
      );
      return;
    }

    if (mercariSession.isStale) {
      Alert.alert(
        'Session May Be Stale',
        `Your Mercari session is ${mercariSession.ageHours}h old. The listing may still work, but if it fails, tap "Connect Mercari" to refresh.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Anyway', onPress: () => doList(item) },
          { text: 'Reconnect First', onPress: () => router.push('/mercari-connect') },
        ]
      );
      return;
    }

    doList(item);
  }, [mercariSession]);

  const doList = async (item) => {
    setListingItemId(item.id);
    try {
      const photos = item.photos || item.image_urls || [];
      const payload = {
        title:       item.item_name || item.name || item.title,
        description: item.description || item.notes || '',
        price:       item.listing_price || item.price,
        images:      photos.map(p => typeof p === 'string' ? p : p.url || p.preview).filter(Boolean),
        categoryId:  item.mercari_category_id || undefined,
        condition:   item.condition || 'Good',
        zipCode:     item.zip || item.ships_from || undefined,
      };

      const result = await createMercariListingServerSide(payload);

      if (result.success) {
        Alert.alert(
          'Listed on Mercari! 🎉',
          `Your item is now live.\n\n${result.url || ''}`,
          [
            { text: 'View on Mercari', onPress: () => {} }, // could open in WebView
            { text: 'Done', style: 'cancel' },
          ]
        );
        loadData();
      } else {
        const isExpired = result.errorType === 'session_expired';
        Alert.alert(
          'Listing Failed',
          result.error || 'Unknown error',
          isExpired
            ? [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reconnect Mercari', onPress: () => router.push('/mercari-connect') },
              ]
            : [{ text: 'OK', style: 'cancel' }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setListingItemId(null);
    }
  };

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.logo}>Orben</Text>
          <Text style={styles.authSubtitle}>Sign in to access your inventory</Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <View style={styles.headerRight}>
          <MercariBadge session={mercariSession} onPress={() => router.push('/mercari-connect')} />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={loadData}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Items list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              isListing={listingItemId === item.id}
              onListMercari={() => handleListOnMercari(item)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No items found</Text>
            </View>
          }
          contentContainerStyle={items.length === 0 && styles.emptyContainer}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MercariBadge({ session, onPress }) {
  const isConnected = session?.isValid;
  const isStale     = session?.isStale;
  return (
    <TouchableOpacity
      style={[
        styles.badge,
        isConnected ? (isStale ? styles.badgeStale : styles.badgeConnected) : styles.badgeDisconnected,
      ]}
      onPress={onPress}
    >
      <Image
        source={{ uri: 'https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B' }}
        style={styles.badgeIcon}
      />
      <Text style={[styles.badgeText, isConnected ? styles.badgeTextConnected : styles.badgeTextDisconnected]}>
        {isConnected ? (isStale ? 'Stale' : 'Connected') : 'Connect'}
      </Text>
    </TouchableOpacity>
  );
}

function InventoryCard({ item, isListing, onListMercari }) {
  const photos = item.photos || item.image_urls || [];
  const thumb  = photos[0]
    ? (typeof photos[0] === 'string' ? photos[0] : photos[0].url || photos[0].preview)
    : null;
  const price  = item.listing_price || item.price;
  const name   = item.item_name || item.name || item.title || 'Untitled';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.cardThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
            <Text style={styles.cardThumbPlaceholderText}>📦</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{name}</Text>
          {price != null && (
            <Text style={styles.cardPrice}>${Number(price).toFixed(2)}</Text>
          )}
          {item.condition && (
            <Text style={styles.cardMeta}>{item.condition}</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnMercari, isListing && styles.actionBtnDisabled]}
          onPress={onListMercari}
          disabled={isListing}
        >
          {isListing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Image
                source={{ uri: 'https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B' }}
                style={styles.actionBtnIcon}
              />
              <Text style={styles.actionBtnText}>List on Mercari</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  headerRight: { flexDirection: 'row', gap: 8 },

  // Mercari badge
  badge: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, gap: 4,
  },
  badgeConnected:    { backgroundColor: '#e6f4ea' },
  badgeStale:        { backgroundColor: '#fff3e0' },
  badgeDisconnected: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd' },
  badgeIcon: { width: 16, height: 16, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextConnected:    { color: '#1e7e34' },
  badgeTextDisconnected: { color: '#555' },

  // Search
  searchContainer: {
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 9, fontSize: 15, color: '#1a1a1a',
  },

  // Loading / empty
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyContainer: { flex: 1 },
  emptyText: { fontSize: 15, color: '#888' },

  // Card
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
    borderRadius: 12, padding: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cardThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#f0f0f0' },
  cardThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardThumbPlaceholderText: { fontSize: 28 },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', lineHeight: 19 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#1a73e8', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },

  // Actions
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, paddingVertical: 8, gap: 6,
  },
  actionBtnMercari: { backgroundColor: '#e8300b' },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnIcon: { width: 16, height: 16, borderRadius: 3 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Auth screen
  authContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 40, fontWeight: '800', color: '#1a73e8', marginBottom: 8 },
  authSubtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  authButton: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

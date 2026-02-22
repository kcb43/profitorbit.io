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
import { router, useFocusEffect } from 'expo-router';

// Lazy-load the API so any init errors don't block rendering
let orbenApi = null;
async function getApi() {
  if (!orbenApi) {
    orbenApi = await import('../src/services/orbenApi');
  }
  return orbenApi;
}

export default function HomeScreen() {
  const [user, setUser]                     = useState(null);
  const [items, setItems]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [search, setSearch]                 = useState('');
  const [mercariSession, setMercariSession] = useState(null);
  const [listingItemId, setListingItemId]   = useState(null);
  const [initError, setInitError]           = useState(null);

  // Auth — lazy init so a Supabase/SecureStore error won't crash the route
  useEffect(() => {
    getApi().then(api => {
      api.supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      }).catch(e => setInitError(e.message));

      const { data: listener } = api.supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => listener.subscription.unsubscribe();
    }).catch(e => {
      setInitError(e.message);
      setLoading(false);
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const api = await getApi();
      const [inv, session] = await Promise.all([
        api.getInventoryItems(search).catch(() => []),
        api.getMercariSession(),
      ]);
      setItems(Array.isArray(inv) ? inv : inv?.items || []);
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
    else if (user === null) setLoading(false);
  }, [user, loadData]);

  // Re-check Mercari session every time this screen gains focus
  // (e.g. after returning from the mercari-connect screen)
  useFocusEffect(useCallback(() => {
    getApi().then(api => api.getMercariSession()).then(session => {
      setMercariSession(session);
    }).catch(() => {});
  }, []));

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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
        `Your Mercari session is ${mercariSession.ageHours}h old. It may still work.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Anyway', onPress: () => doList(item) },
          { text: 'Reconnect', onPress: () => router.push('/mercari-connect') },
        ]
      );
      return;
    }
    doList(item);
  }, [mercariSession]);

  const doList = async (item) => {
    setListingItemId(item.id);
    try {
      const api = await getApi();
      const photos = item.photos || item.image_urls || [];
      const result = await api.createMercariListingServerSide({
        title:       item.item_name || item.name || item.title,
        description: item.description || item.notes || '',
        price:       item.listing_price || item.price,
        images:      photos.map(p => typeof p === 'string' ? p : p.url || p.preview).filter(Boolean),
        condition:   item.condition || 'Good',
      });
      if (result.success) {
        Alert.alert('Listed on Mercari!', result.url || '');
        loadData();
      } else {
        const expired = result.errorType === 'session_expired';
        Alert.alert('Listing Failed', result.error || 'Unknown error',
          expired
            ? [{ text: 'Reconnect', onPress: () => router.push('/mercari-connect') }]
            : [{ text: 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setListingItemId(null);
    }
  };

  // ── Error state ───────────────────────────────────────────────────────────
  if (initError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Setup Error</Text>
          <Text style={styles.errorMsg}>{initError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.logo}>Orben</Text>
          <Text style={styles.authSubtitle}>Sign in to access your inventory</Text>
          <TouchableOpacity style={styles.authButton} onPress={() => router.push('/auth')}>
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <MercariBadge session={mercariSession} onPress={() => router.push('/mercari-connect')} />
      </View>

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
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
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </SafeAreaView>
  );
}

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
      <Text style={styles.badgeText}>
        {isConnected ? (isStale ? 'Mercari ⚠️' : 'Mercari ✓') : 'Connect Mercari'}
      </Text>
    </TouchableOpacity>
  );
}

function InventoryCard({ item, isListing, onListMercari }) {
  const photos = item.photos || item.image_urls || [];
  const thumb  = photos[0]
    ? (typeof photos[0] === 'string' ? photos[0] : photos[0].url || photos[0].preview)
    : null;
  const price = item.listing_price || item.price;
  const name  = item.item_name || item.name || item.title || 'Untitled';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.cardThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
            <Text style={{ fontSize: 28 }}>📦</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{name}</Text>
          {price != null && <Text style={styles.cardPrice}>${Number(price).toFixed(2)}</Text>}
          {item.condition && <Text style={styles.cardMeta}>{item.condition}</Text>}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.mercariBtn, isListing && { opacity: 0.6 }]}
        onPress={onListMercari}
        disabled={isListing}
      >
        {isListing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.mercariBtnText}>List on Mercari</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },

  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  badgeConnected:    { backgroundColor: '#e6f4ea' },
  badgeStale:        { backgroundColor: '#fff3e0' },
  badgeDisconnected: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#444' },

  searchContainer: {
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 9, fontSize: 15, color: '#1a1a1a',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyContainer: { flex: 1 },
  emptyText: { fontSize: 15, color: '#888' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#c00', marginBottom: 8 },
  errorMsg: { fontSize: 13, color: '#666', textAlign: 'center' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
    borderRadius: 12, padding: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cardThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#f0f0f0' },
  cardThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', lineHeight: 19 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#1a73e8', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },

  mercariBtn: {
    backgroundColor: '#e8300b', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  mercariBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  authContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 40, fontWeight: '800', color: '#1a73e8', marginBottom: 8 },
  authSubtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  authButton: {
    backgroundColor: '#1a73e8', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48,
  },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

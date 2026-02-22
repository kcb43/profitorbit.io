import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, radius, shadow } from '../../../src/components/ui/theme';
import Button from '../../../src/components/ui/Button';
import Input from '../../../src/components/ui/Input';
import Card from '../../../src/components/ui/Card';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

const CONDITIONS  = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
const SOURCES     = ['eBay', 'Amazon', 'Walmart', 'Thrift Store', 'Garage Sale', 'Facebook', 'Other'];
const CATEGORIES  = ['Electronics', 'Clothing', 'Shoes', 'Books', 'Toys & Games', 'Home & Garden', 'Sports', 'Collectibles', 'Other'];

function PickerRow({ label, options, value, onChange }) {
  return (
    <View style={styles.pickerSection}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.pickerChip, value === opt && styles.pickerChipActive]}
            onPress={() => onChange(opt === value ? '' : opt)}
          >
            <Text style={[styles.pickerChipText, value === opt && styles.pickerChipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function AddItemScreen() {
  const { editId } = useLocalSearchParams();
  const isEdit = !!editId;

  const [photos, setPhotos]         = useState([]);
  const [name, setName]             = useState('');
  const [purchasePrice, setPurchase]= useState('');
  const [listingPrice, setListing]  = useState('');
  const [condition, setCondition]   = useState('Good');
  const [source, setSource]         = useState('');
  const [category, setCategory]     = useState('');
  const [brand, setBrand]           = useState('');
  const [notes, setNotes]           = useState('');
  const [description, setDesc]      = useState('');
  const [loading, setLoading]       = useState(isEdit);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getApi().then(a => a.getInventoryItem(editId)).then(item => {
      setName(item.item_name || item.name || '');
      setPurchase(String(item.purchase_price ?? ''));
      setListing(String(item.listing_price ?? ''));
      setCondition(item.condition || 'Good');
      setSource(item.source || '');
      setCategory(item.category || '');
      setBrand(item.brand || '');
      setNotes(item.notes || '');
      setDesc(item.description || '');
      const p = item.photos || item.images || (item.image_url ? [item.image_url] : []) || [];
      setPhotos(p.map(x => ({ uri: typeof x === 'string' ? x : x?.url || x?.preview || '' })).filter(x => x.uri));
    }).catch(() => Alert.alert('Error', 'Could not load item.'))
      .finally(() => setLoading(false));
  }, [editId]);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => ({ uri: a.uri, local: true }))].slice(0, 12));
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setPhotos(prev => [...prev, { uri: result.assets[0].uri, local: true }].slice(0, 12));
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an item name.');
      return;
    }
    setSaving(true);
    try {
      const a = await getApi();
      const payload = {
        item_name:      name.trim(),
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        listing_price:  listingPrice  ? parseFloat(listingPrice)  : null,
        condition,
        source:         source || null,
        category:       category || null,
        brand:          brand.trim() || null,
        notes:          notes.trim() || null,
        description:    description.trim() || null,
        status:         'In Stock',
      };

      if (isEdit) {
        await a.updateInventoryItem(editId, payload);
        Alert.alert('Saved!', 'Item updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await a.createInventoryItem(payload);
        Alert.alert('Added!', 'Item added to inventory.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save item.');
    } finally {
      setSaving(false);
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
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Item' : 'Add Item'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.saveBtn}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Photos */}
          <Card style={styles.photoCard} padded={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {/* Add Photo Buttons */}
              <TouchableOpacity style={styles.addPhoto} onPress={takePhoto}>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPhoto} onPress={pickPhoto}>
                <Text style={styles.addPhotoIcon}>🖼</Text>
                <Text style={styles.addPhotoLabel}>Library</Text>
              </TouchableOpacity>
              {/* Existing Photos */}
              {photos.map((p, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  >
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.photoHint}>{photos.length}/12 photos</Text>
          </Card>

          {/* Core Fields */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Item Info</Text>
            <Input label="Item Name *" value={name} onChangeText={setName} placeholder="e.g. Nike Air Max 90" />
            <Input label="Brand" value={brand} onChangeText={setBrand} placeholder="e.g. Nike" />
            <PickerRow label="Condition" options={CONDITIONS} value={condition} onChange={setCondition} />
            <PickerRow label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
          </Card>

          {/* Pricing */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={styles.priceRow}>
              <Input
                label="Purchase Price"
                value={purchasePrice}
                onChangeText={setPurchase}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={styles.halfInput}
              />
              <Input
                label="Listing Price"
                value={listingPrice}
                onChangeText={setListing}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={styles.halfInput}
              />
            </View>
            {purchasePrice && listingPrice ? (
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>Estimated Profit</Text>
                <Text style={[styles.profitValue, {
                  color: parseFloat(listingPrice) - parseFloat(purchasePrice) >= 0 ? colors.success : colors.danger,
                }]}>
                  ${(parseFloat(listingPrice || 0) - parseFloat(purchasePrice || 0)).toFixed(2)}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Source */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Sourcing</Text>
            <PickerRow label="Source" options={SOURCES} value={source} onChange={setSource} />
          </Card>

          {/* Description / Notes */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <Input
              label="Description"
              value={description}
              onChangeText={setDesc}
              placeholder="Item description for listings…"
              multiline
              numberOfLines={4}
            />
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Internal notes…"
              multiline
              numberOfLines={3}
            />
          </Card>

          <Button onPress={handleSave} loading={saving} style={styles.saveFullBtn}>
            {isEdit ? 'Save Changes' : 'Add to Inventory'}
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
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  headerTitle: { ...typography.h4, color: colors.textPrimary },
  cancel: { ...typography.body, color: colors.textMuted },
  saveBtn: { ...typography.body, color: colors.primary, fontWeight: '700' },

  scroll: { padding: spacing.lg, gap: spacing.md },

  photoCard: { marginBottom: spacing.md, overflow: 'hidden' },
  photoScroll: { padding: spacing.sm },
  addPhoto: {
    width: 80, height: 80, borderRadius: radius.md,
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  addPhotoIcon: { fontSize: 24 },
  addPhotoLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  photoWrap: { marginRight: spacing.sm, position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: radius.md },
  removePhoto: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: colors.danger, borderRadius: 10, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  photoHint: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },

  section: { marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },

  priceRow: { flexDirection: 'row', gap: spacing.sm },
  halfInput: { flex: 1 },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  profitLabel: { ...typography.bodySmall, color: colors.textMuted },
  profitValue: { ...typography.body, fontWeight: '700' },

  pickerSection: { marginBottom: spacing.md },
  pickerLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, textTransform: 'uppercase' },
  pickerScroll: { flexGrow: 0 },
  pickerChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgInput, marginRight: spacing.sm,
  },
  pickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '500' },
  pickerChipTextActive: { color: colors.textInverse, fontWeight: '700' },

  saveFullBtn: { marginTop: spacing.md },
});

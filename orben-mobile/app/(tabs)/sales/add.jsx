import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '../../../src/components/ui/theme';
import Button from '../../../src/components/ui/Button';
import Input from '../../../src/components/ui/Input';
import Card from '../../../src/components/ui/Card';

let api = null;
async function getApi() {
  if (!api) api = await import('../../../src/services/orbenApi');
  return api;
}

const PLATFORMS = ['Mercari', 'eBay', 'Facebook Marketplace', 'Poshmark', 'Depop', 'Other'];

function PickerRow({ label, options, value, onChange }) {
  return (
    <View style={styles.pickerSection}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

export default function AddSaleScreen() {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showPicker, setShowPicker]         = useState(false);
  const [itemSearch, setItemSearch]         = useState('');

  const [salePrice, setSalePrice]   = useState('');
  const [platform, setPlatform]     = useState('');
  const [saleDate, setSaleDate]     = useState(new Date().toISOString().split('T')[0]);
  const [shippingCost, setShipping] = useState('');
  const [fees, setFees]             = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    getApi().then(a => a.getInventoryItems('', 100))
      .then(result => {
        const arr = Array.isArray(result) ? result : result?.items || [];
        setInventoryItems(arr.filter(i => (i.status || '').toLowerCase() !== 'sold'));
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, []);

  const selectedItem = inventoryItems.find(i => String(i.id) === String(selectedItemId));
  const filteredItems = inventoryItems.filter(i => {
    const name = (i.item_name || i.name || '').toLowerCase();
    return name.includes(itemSearch.toLowerCase());
  });

  const profit = salePrice && selectedItem?.purchase_price
    ? (parseFloat(salePrice) - parseFloat(selectedItem.purchase_price) - parseFloat(shippingCost || 0) - parseFloat(fees || 0)).toFixed(2)
    : null;

  async function handleSave() {
    if (!salePrice || parseFloat(salePrice) <= 0) {
      Alert.alert('Required', 'Please enter the sale price.');
      return;
    }
    setSaving(true);
    try {
      const a = await getApi();
      const payload = {
        item_id:       selectedItemId || null,
        item_name:     selectedItem?.item_name || selectedItem?.name || 'Manual Sale',
        sale_price:    parseFloat(salePrice),
        platform:      platform || null,
        sale_date:     saleDate,
        shipping_cost: shippingCost ? parseFloat(shippingCost) : null,
        fees:          fees ? parseFloat(fees) : null,
        notes:         notes.trim() || null,
        profit:        profit ? parseFloat(profit) : null,
      };
      await a.recordSale(payload);
      Alert.alert('Sale Recorded!', 'Your sale has been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save sale.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Sale</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.saveBtn}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Link to Inventory Item */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory Item (optional)</Text>
            <TouchableOpacity
              style={styles.itemPickerBtn}
              onPress={() => setShowPicker(!showPicker)}
            >
              <Text style={styles.itemPickerText}>
                {selectedItem
                  ? (selectedItem.item_name || selectedItem.name)
                  : 'Select inventory item…'}
              </Text>
              <Text style={styles.itemPickerChevron}>{showPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPicker && (
              <View style={styles.itemList}>
                <Input
                  value={itemSearch}
                  onChangeText={setItemSearch}
                  placeholder="Search…"
                  autoCapitalize="none"
                  style={{ marginBottom: spacing.sm }}
                />
                {loadingItems ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  filteredItems.slice(0, 20).map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemOption, String(selectedItemId) === String(item.id) && styles.itemOptionActive]}
                      onPress={() => {
                        setSelectedItemId(item.id);
                        if (item.listing_price) setSalePrice(String(item.listing_price));
                        setShowPicker(false);
                      }}
                    >
                      <Text style={styles.itemOptionText}>{item.item_name || item.name}</Text>
                      {item.listing_price && (
                        <Text style={styles.itemOptionPrice}>${item.listing_price}</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </Card>

          {/* Sale Details */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Sale Details</Text>
            <Input
              label="Sale Price *"
              value={salePrice}
              onChangeText={setSalePrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Input
              label="Sale Date"
              value={saleDate}
              onChangeText={setSaleDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <PickerRow label="Platform" options={PLATFORMS} value={platform} onChange={setPlatform} />
          </Card>

          {/* Costs */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Costs (optional)</Text>
            <View style={styles.costRow}>
              <Input
                label="Shipping Cost"
                value={shippingCost}
                onChangeText={setShipping}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={styles.halfInput}
              />
              <Input
                label="Platform Fees"
                value={fees}
                onChangeText={setFees}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={styles.halfInput}
              />
            </View>

            {profit !== null && (
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>Estimated Profit</Text>
                <Text style={[styles.profitValue, { color: parseFloat(profit) >= 0 ? colors.primary : colors.danger }]}>
                  {parseFloat(profit) >= 0 ? '+' : ''}${profit}
                </Text>
              </View>
            )}
          </Card>

          {/* Notes */}
          <Card style={styles.section}>
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes…"
              multiline
              numberOfLines={3}
            />
          </Card>

          <Button onPress={handleSave} loading={saving} style={{ marginTop: spacing.sm }}>
            Save Sale
          </Button>
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  cancel: { ...typography.body, color: colors.textMuted },
  saveBtn: { ...typography.body, color: colors.primary, fontWeight: '700' },

  scroll: { padding: spacing.lg, gap: spacing.md },
  section: { marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },

  itemPickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgInput, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 13,
  },
  itemPickerText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  itemPickerChevron: { color: colors.textMuted, marginLeft: spacing.sm },

  itemList: {
    marginTop: spacing.sm, backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    maxHeight: 240, overflow: 'hidden', padding: spacing.sm,
  },
  itemOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  itemOptionActive: { backgroundColor: `${colors.primary}22` },
  itemOptionText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  itemOptionPrice: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  costRow: { flexDirection: 'row', gap: spacing.sm },
  halfInput: { flex: 1 },
  profitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm,
  },
  profitLabel: { ...typography.body, color: colors.textSecondary },
  profitValue: { ...typography.h3, fontWeight: '800' },

  pickerSection: { marginBottom: spacing.md },
  pickerLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, textTransform: 'uppercase' },
  pickerChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgInput, marginRight: spacing.sm,
  },
  pickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '500' },
  pickerChipTextActive: { color: colors.textInverse, fontWeight: '700' },
});

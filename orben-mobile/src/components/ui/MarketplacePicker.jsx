import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, TextInput,
  StyleSheet, Image, Alert, KeyboardAvoidingView, Platform,
  Pressable, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, radius } from './theme';

// ─── Logo Component ──────────────────────────────────────────────────────────

function MarketplaceLogo({ domain, color, emoji, name, size = 40 }) {
  const [imgError, setImgError] = useState(false);

  if (domain && !imgError) {
    return (
      <View style={[logoStyles.wrap, { width: size, height: size, borderRadius: size * 0.22, backgroundColor: '#fff' }]}>
        <Image
          source={{ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` }}
          style={{ width: size * 0.72, height: size * 0.72 }}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  return (
    <View style={[logoStyles.wrap, { width: size, height: size, borderRadius: size * 0.22, backgroundColor: color }]}>
      {emoji ? (
        <Text style={{ fontSize: size * 0.44, lineHeight: size * 0.56 }}>{emoji}</Text>
      ) : (
        <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '800', lineHeight: size * 0.56 }}>
          {(name || '?').charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const logoStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

// ─── Main MarketplacePicker ──────────────────────────────────────────────────

/**
 * Props:
 *   label        - Field label (string)
 *   value        - Currently selected marketplace name (string)
 *   onChange     - (name: string) => void
 *   items        - Array of marketplace objects from constants/marketplaces.js
 *   storageKey   - AsyncStorage key for persisting custom entries (string)
 *   placeholder  - Placeholder text when nothing selected
 */
export default function MarketplacePicker({
  label,
  value,
  onChange,
  items = [],
  storageKey = 'orben_custom_marketplaces',
  placeholder = 'Select…',
}) {
  const [visible, setVisible]         = useState(false);
  const [search, setSearch]           = useState('');
  const [customItems, setCustomItems] = useState([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef(null);

  // Load custom items from AsyncStorage on mount / key change
  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then(raw => {
        if (raw) setCustomItems(JSON.parse(raw));
      })
      .catch(() => {});
  }, [storageKey]);

  const saveCustomItems = useCallback(async (list) => {
    setCustomItems(list);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
    } catch (_) {}
  }, [storageKey]);

  // All combined items: standard + custom (custom ones won't have domain/emoji)
  const allItems = useMemo(() => {
    const customAsItems = customItems.map(name => ({
      id: `custom__${name}`,
      name,
      domain: null,
      color: '#10b981',
      emoji: '✦',
      custom: true,
    }));
    return [...items, ...customAsItems];
  }, [items, customItems]);

  // Find the currently selected marketplace object (for display in trigger button)
  const selectedEntry = useMemo(() => {
    if (!value) return null;
    return allItems.find(m => m.name === value) || { id: '__unknown__', name: value, domain: null, color: '#555', emoji: '•' };
  }, [value, allItems]);

  // Filtered standard items
  const filteredStandard = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? items.filter(m => m.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  // Filtered custom items
  const filteredCustom = useMemo(() => {
    const q = search.toLowerCase().trim();
    const custom = allItems.filter(m => m.custom);
    return q ? custom.filter(m => m.name.toLowerCase().includes(q)) : custom;
  }, [allItems, search]);

  const handleSelect = useCallback((name) => {
    onChange(name === value ? '' : name);
    setVisible(false);
    setSearch('');
    setAddingCustom(false);
    setCustomInput('');
  }, [value, onChange]);

  const handleAddCustom = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    // Check for duplicate (case-insensitive) across standard + custom
    const existing = allItems.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      // If it's a match to a standard item, just select that instead
      handleSelect(existing.name);
      setAddingCustom(false);
      setCustomInput('');
      return;
    }

    const updated = [...customItems, trimmed];
    saveCustomItems(updated);
    handleSelect(trimmed);
    setAddingCustom(false);
    setCustomInput('');
  }, [customInput, allItems, customItems, saveCustomItems, handleSelect]);

  const handleRemoveCustom = useCallback((name) => {
    Alert.alert('Remove Source', `Remove "${name}" from your custom list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          const updated = customItems.filter(c => c !== name);
          saveCustomItems(updated);
          if (value === name) onChange('');
        },
      },
    ]);
  }, [customItems, saveCustomItems, value, onChange]);

  const renderItem = useCallback(({ item }) => {
    const isSelected = item.name === value;
    return (
      <TouchableOpacity
        style={[s.row, isSelected && s.rowSelected]}
        onPress={() => handleSelect(item.name)}
        activeOpacity={0.7}
      >
        <MarketplaceLogo domain={item.domain} color={item.color} emoji={item.emoji} name={item.name} size={38} />
        <Text style={[s.rowName, isSelected && s.rowNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.custom && (
          <TouchableOpacity
            style={s.removeBtn}
            onPress={() => handleRemoveCustom(item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
        {isSelected && !item.custom && (
          <Text style={s.checkmark}>✓</Text>
        )}
      </TouchableOpacity>
    );
  }, [value, handleSelect, handleRemoveCustom]);

  const listData = useMemo(() => {
    const result = [];
    if (filteredStandard.length > 0) {
      result.push({ type: 'header', key: 'h1', title: 'Marketplaces & Sources' });
      filteredStandard.forEach(m => result.push({ type: 'item', key: m.id, ...m }));
    }
    if (filteredCustom.length > 0) {
      result.push({ type: 'header', key: 'h2', title: 'My Custom Sources' });
      filteredCustom.forEach(m => result.push({ type: 'item', key: m.id, ...m }));
    }
    return result;
  }, [filteredStandard, filteredCustom]);

  const renderListEntry = useCallback(({ item }) => {
    if (item.type === 'header') {
      return <Text style={s.sectionHeader}>{item.title}</Text>;
    }
    return renderItem({ item });
  }, [renderItem]);

  return (
    <>
      {/* ── Trigger Button ───────────────────────────────────────────── */}
      <View style={s.fieldWrap}>
        {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
        <TouchableOpacity style={s.trigger} onPress={() => setVisible(true)} activeOpacity={0.7}>
          {selectedEntry ? (
            <View style={s.triggerInner}>
              <MarketplaceLogo
                domain={selectedEntry.domain}
                color={selectedEntry.color}
                emoji={selectedEntry.emoji}
                name={selectedEntry.name}
                size={28}
              />
              <Text style={s.triggerValue} numberOfLines={1}>{selectedEntry.name}</Text>
              <TouchableOpacity
                onPress={() => onChange('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={s.clearBtn}
              >
                <Text style={s.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.triggerInner}>
              <Text style={s.triggerPlaceholder}>{placeholder}</Text>
              <Text style={s.triggerChevron}>›</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modal}
        >
          {/* Header */}
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{label || 'Select'}</Text>
            <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); setAddingCustom(false); setCustomInput(''); }}>
              <Text style={s.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search…"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <FlatList
            data={listData}
            keyExtractor={item => item.key}
            renderItem={renderListEntry}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
          />

          {/* Add Custom Source */}
          <View style={s.addCustomBar}>
            {addingCustom ? (
              <View style={s.addCustomRow}>
                <TextInput
                  ref={customInputRef}
                  style={s.addCustomInput}
                  value={customInput}
                  onChangeText={setCustomInput}
                  placeholder="Custom source name…"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddCustom}
                  maxLength={60}
                />
                <TouchableOpacity style={s.addCustomSave} onPress={handleAddCustom}>
                  <Text style={s.addCustomSaveText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.addCustomCancel} onPress={() => { setAddingCustom(false); setCustomInput(''); }}>
                  <Text style={s.addCustomCancelText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.addCustomBtn} onPress={() => { setAddingCustom(true); }}>
                <Text style={s.addCustomBtnIcon}>+</Text>
                <Text style={s.addCustomBtnText}>Add Custom Source</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Trigger
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  trigger: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    minHeight: 48,
    justifyContent: 'center',
  },
  triggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  triggerPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  triggerChevron: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 22,
  },
  clearBtn: { padding: 4 },
  clearBtnText: { color: colors.textMuted, fontSize: 13 },

  // Modal
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  modalClose: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  searchIcon: {
    fontSize: 18,
    color: colors.textMuted,
    lineHeight: 22,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  searchClear: {
    color: colors.textMuted,
    fontSize: 13,
    padding: 4,
  },

  // Section header
  sectionHeader: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },

  // List row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderRadius: 0,
  },
  rowSelected: {
    backgroundColor: `${colors.primary}18`,
  },
  rowName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '400',
  },
  rowNameSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  removeBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  // Add Custom
  addCustomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}22`,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  addCustomBtnIcon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  addCustomBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addCustomInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  addCustomSave: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  addCustomSaveText: {
    ...typography.body,
    color: colors.textInverse,
    fontWeight: '700',
  },
  addCustomCancel: {
    padding: 8,
  },
  addCustomCancelText: {
    color: colors.textMuted,
    fontSize: 16,
  },
});

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

export default function AccountScreen() {
  const [user, setUser]           = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    getApi().then(a => a.supabase.auth.getSession()).then(({ data: { session } }) => {
      const u = session?.user;
      setUser(u);
      setFirstName(u?.user_metadata?.first_name || '');
      setLastName(u?.user_metadata?.last_name || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const a = await getApi();
      const { error } = await a.supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        },
      });
      if (error) throw error;
      Alert.alert('Saved!', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    const email = user?.email;
    if (!email) return;
    try {
      const a = await getApi();
      await a.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://profitorbit.io/reset-password',
      });
      Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.saveText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.avatarEmail}>{user?.email}</Text>
          </View>

          {/* Profile Form */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <Input label="First Name" value={firstName} onChangeText={setFirstName} placeholder="Jane" />
            <Input label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Doe" />
            <Input label="Email" value={user?.email || ''} editable={false} />
          </Card>

          {/* Security */}
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Security</Text>
            <Button variant="secondary" onPress={handleChangePassword}>
              Send Password Reset Email
            </Button>
          </Card>

          <Button onPress={handleSave} loading={saving} style={{ marginTop: spacing.sm }}>
            Save Changes
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
  backText: { ...typography.body, color: colors.primary },
  saveText: { ...typography.body, color: colors.primary, fontWeight: '700' },

  scroll: { padding: spacing.lg },

  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.textInverse },
  avatarEmail: { ...typography.bodySmall, color: colors.textMuted },

  card: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
});

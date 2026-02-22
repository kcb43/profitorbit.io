import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, typography, radius } from '../../src/components/ui/theme';
import Button from '../../src/components/ui/Button';
import Input from '../../src/components/ui/Input';

let _supabase = null;
async function getSupabase() {
  if (!_supabase) {
    const mod = await import('../../src/services/orbenApi');
    _supabase = mod.supabase;
  }
  return _supabase;
}

export default function ResetPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleReset() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://profitorbit.io/reset-password',
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      // Show success even on error to prevent email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.back}>
            <Button variant="ghost" onPress={() => router.back()} fullWidth={false} size="sm">
              ← Back
            </Button>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </View>

          {sent ? (
            <View style={styles.card}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successText}>
                If an account exists for {email}, you'll receive a reset link shortly.
              </Text>
              <Button onPress={() => router.replace('/(auth)/sign-in')} style={{ marginTop: spacing.xl }}>
                Back to Sign In
              </Button>
            </View>
          ) : (
            <View style={styles.card}>
              <Input
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
              <Button onPress={handleReset} loading={loading} style={{ marginTop: spacing.sm }}>
                Send Reset Link
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  back: { marginBottom: spacing.xl },

  header: { marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },

  successIcon: { fontSize: 52, marginBottom: spacing.lg },
  successTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  successText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});

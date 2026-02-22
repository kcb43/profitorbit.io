import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
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

export default function SignInScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      Alert.alert('Sign In Failed', err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first, then tap Forgot Password.');
      return;
    }
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://profitorbit.io/reset-password',
      });
      if (error) throw error;
      setResetSent(true);
      Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>O</Text>
            </View>
            <Text style={styles.logoText}>Orben</Text>
            <Text style={styles.tagline}>Your resale business, anywhere.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>
                {resetSent ? '✓ Reset email sent' : 'Forgot password?'}
              </Text>
            </TouchableOpacity>

            <Button onPress={handleSignIn} loading={loading} style={styles.signInBtn}>
              Sign In
            </Button>
          </View>

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.footerLink}>Sign Up Free</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },

  logoArea: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoMark: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoLetter: { fontSize: 36, fontWeight: '800', color: colors.textInverse },
  logoText: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  tagline: { ...typography.body, color: colors.textSecondary },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  cardTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xl },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: spacing.lg, marginTop: -spacing.sm },
  forgotText: { ...typography.bodySmall, color: colors.primary },

  signInBtn: { marginTop: spacing.sm },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
});

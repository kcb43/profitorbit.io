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

export default function SignUpScreen() {
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);

  async function handleSignUp() {
    if (!firstName.trim() || !email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please fill in your name, email, and password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name:  lastName.trim(),
            full_name:  `${firstName.trim()} ${lastName.trim()}`.trim(),
          },
        },
      });
      if (error) throw error;

      Alert.alert(
        'Check Your Email',
        'We sent a verification link to your email. Click it to activate your account.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }]
      );
    } catch (err) {
      Alert.alert('Sign Up Failed', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.logoArea}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>O</Text>
            </View>
            <Text style={styles.logoText}>Orben</Text>
            <Text style={styles.tagline}>Start growing your resale business.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Account</Text>

            <View style={styles.nameRow}>
              <Input
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                style={styles.halfInput}
                returnKeyType="next"
              />
              <Input
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                style={styles.halfInput}
                returnKeyType="next"
              />
            </View>

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
              placeholder="Min. 6 characters"
              secureTextEntry
              returnKeyType="next"
            />
            <Input
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
            />

            <Button onPress={handleSignUp} loading={loading} style={styles.btn}>
              Create Account
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign In</Text>
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

  logoArea: { alignItems: 'center', marginBottom: spacing.xl },
  logoMark: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoLetter: { fontSize: 28, fontWeight: '800', color: colors.textInverse },
  logoText: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  tagline: { ...typography.bodySmall, color: colors.textSecondary },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  cardTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xl },

  nameRow: { flexDirection: 'row', gap: spacing.sm },
  halfInput: { flex: 1 },

  btn: { marginTop: spacing.sm },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
});

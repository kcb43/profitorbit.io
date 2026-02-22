import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../src/components/ui/theme';

let _supabase = null;
async function getSupabase() {
  if (!_supabase) {
    const mod = await import('../src/services/orbenApi');
    _supabase = mod.supabase;
  }
  return _supabase;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let sub;
    getSupabase().then(supabase => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/(auth)/sign-in');
        }
        setReady(true);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          router.replace('/(tabs)/dashboard');
        } else if (event === 'SIGNED_OUT') {
          router.replace('/(auth)/sign-in');
        }
      });
      sub = listener.subscription;
    }).catch(() => {
      router.replace('/(auth)/sign-in');
      setReady(true);
    });
    return () => sub?.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="mercari-connect"
          options={{
            headerShown: true,
            title: 'Connect Mercari',
            headerStyle: { backgroundColor: colors.bgCard },
            headerTintColor: colors.textPrimary,
            presentation: 'modal',
          }}
        />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

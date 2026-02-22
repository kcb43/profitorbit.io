import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { colors } from '../src/components/ui/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash quickly — index.jsx handles auth redirect
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
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

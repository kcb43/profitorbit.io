import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Orben', headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In', headerShown: false }} />
        <Stack.Screen
          name="mercari-connect"
          options={{ title: 'Connect Mercari', headerBackTitle: 'Back', presentation: 'modal' }}
        />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

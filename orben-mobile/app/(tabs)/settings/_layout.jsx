import { Stack } from 'expo-router';
import { colors } from '../../../src/components/ui/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="marketplaces" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

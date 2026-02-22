import { Stack } from 'expo-router';
import { colors } from '../../../src/components/ui/theme';

export default function InventoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" />
    </Stack>
  );
}

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../src/components/ui/theme';

const TAB_ICONS = {
  dashboard: '⊞',
  inventory: '📦',
  crosslist: '🔄',
  sales:     '💰',
  settings:  '⚙️',
};

function TabIcon({ name, focused }) {
  const emoji = TAB_ICONS[name] || '●';
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={styles.iconEmoji}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          tabBarLabel: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon name="inventory" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="crosslist"
        options={{
          tabBarLabel: 'Crosslist',
          tabBarIcon: ({ focused }) => <TabIcon name="crosslist" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          tabBarLabel: 'Sales',
          tabBarIcon: ({ focused }) => <TabIcon name="sales" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgCard,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },

  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    minWidth: 40,
  },
  iconWrapActive: {
    backgroundColor: `${colors.primary}1A`,
  },
  iconEmoji: { fontSize: 20 },
});

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../src/components/ui/theme';

function TabIcon({ name, focused }) {
  const ICONS = {
    dashboard:  { default: '⊞',  active: '⊞'  },
    inventory:  { default: '📦', active: '📦' },
    crosslist:  { default: '🔄', active: '🔄' },
    sales:      { default: '💰', active: '💰' },
    settings:   { default: '⚙️', active: '⚙️' },
  };
  const icon = ICONS[name] || { default: '●', active: '●' };
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={styles.iconEmoji}>{focused ? icon.active : icon.default}</Text>
    </View>
  );
}

function TabLabel({ label, focused }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
      {label}
    </Text>
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
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon name="inventory" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Inventory" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="crosslist"
        options={{
          title: 'Crosslist',
          tabBarIcon: ({ focused }) => <TabIcon name="crosslist" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Crosslist" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ focused }) => <TabIcon name="sales" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Sales" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Settings" focused={focused} />,
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    height: 60,
  },
  tabBarLabel: { display: 'none' },

  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: `${colors.primary}18`,
  },
  iconEmoji: { fontSize: 22 },

  tabLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  tabLabelActive: { color: colors.primary, fontWeight: '600' },
});

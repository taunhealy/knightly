import React from 'react';
import { Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHomeSeek } from '@/lib/store';

export default function TabLayout() {
  const { compareList } = useHomeSeek();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#71717a',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e4e4e7',
          minHeight: 68 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 14,
          marginBottom: 2,
        },
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '800',
          color: '#09090b',
          fontSize: 17,
        },
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={10}
            style={{ marginRight: 14, padding: 4 }}
            accessibilityLabel="Open Profile and Backend API Settings"
          >
            <Ionicons name="settings-outline" size={21} color="#3f3f46" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          headerTitle: 'Knightly · Search',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: 'Compare',
          headerTitle: 'Side-by-Side Compare',
          tabBarBadge: compareList.length > 0 ? compareList.length : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="git-compare-outline" size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="inspection"
        options={{
          title: 'Inspect',
          headerTitle: 'Ingoing Inspection',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size - 2} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
          title: 'Alerts',
          headerTitle: 'AI Radar Alerts',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Profile & Favourites',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size - 1} color={color as string} />,
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}

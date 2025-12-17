import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

export default function ProviderLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#007AFF',
                tabBarStyle: { paddingBottom: 5, height: 60 },
                headerShown: true,
            }}
        >
            {/* Tab 1: Dashboard */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Earnings',
                    // Fix: We added types ({ color, size }: { color: string; size: number })
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="cash" size={size} color={color} />
                    ),
                }}
            />

            {/* Tab 2: Requests */}
            <Tabs.Screen
                name="requests"
                options={{
                    title: 'Requests',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="notifications" size={size} color={color} />
                    ),
                }}
            />

            {/* Tab 3: Active Sites */}
            <Tabs.Screen
                name="active"
                options={{
                    title: 'My Sites',
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                        <Ionicons name="hammer" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
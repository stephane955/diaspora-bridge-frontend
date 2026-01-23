import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

export default function ProviderLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#0EA5E9',
                tabBarInactiveTintColor: '#94A3B8',
            }}
        >
            <Tabs.Screen name="index" options={{
                tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            }} />

            <Tabs.Screen name="active" options={{
                tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? "folder-open" : "folder-outline"} size={24} color={color} />
            }} />

            {/* SEARCH TAB (Middle) */}
            <Tabs.Screen name="requests" options={{
                tabBarIcon: () => (
                    <View style={styles.fabButton}><Ionicons name="search" size={26} color="#fff" /></View>
                )
            }} />

            <Tabs.Screen name="earnings" options={{
                tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? "wallet" : "wallet-outline"} size={24} color={color} />
            }} />

            {/* Hidden Utility Screens */}
            <Tabs.Screen name="job/[id]" options={{ href: null }} />
            <Tabs.Screen name="request-payout" options={{ href: null }} />
            <Tabs.Screen name="post_update" options={{ href: null }} />
            <Tabs.Screen name="withdraw" options={{ href: null }} />
            <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute', bottom: 25, left: 20, right: 20, elevation: 5, backgroundColor: '#ffffff',
        borderRadius: 25, height: 70, shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1, shadowRadius: 10, borderTopWidth: 0, alignItems: 'center', justifyContent: 'center',
    },
    fabButton: {
        width: 50, height: 50, borderRadius: 25, backgroundColor: '#0F172A',
        justifyContent: 'center', alignItems: 'center', marginBottom: 5,
        shadowColor: "#0F172A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    }
});

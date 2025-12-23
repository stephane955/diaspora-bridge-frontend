import { Tabs } from 'expo-router';
import React from 'react';

export default function ProviderLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' }, // Hides the system bar
            }}
        >
            {/* These names MUST match your file names exactly */}
            <Tabs.Screen name="index" />
            <Tabs.Screen name="active" />
            <Tabs.Screen name="earnings" />
            <Tabs.Screen name="requests" />
            <Tabs.Screen name="withdraw" />
        </Tabs>
    );
}
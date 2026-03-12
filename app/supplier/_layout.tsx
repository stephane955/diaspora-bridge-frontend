import React from 'react';
import { Stack } from 'expo-router';

export default function SupplierLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="scanner" options={{ presentation: 'modal' }} />
        </Stack>
    );
}

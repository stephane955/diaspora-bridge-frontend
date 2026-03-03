import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { usePushNotifications } from '@/hooks/usePushNotifications'; // <--- IMPORT

function InitialLayout() {
    const { session, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    // --- ACTIVATE NOTIFICATIONS ---
    // This starts listening immediately. It will only save the token
    // once 'session' (user) is available, which is handled inside the hook.
    usePushNotifications();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted || loading) return;

        // FIX: Check if we are on the root path (Landing Page)
        // segments is [] when on the Landing Page ('/')
        const inPublicGroup =
            segments.length === 0 ||
            segments[0] === 'index' ||
            segments[0] === 'login' ||
            segments[0] === 'signup';

        // 1. If NOT logged in and trying to access a private page -> Send to Login
        if (!session && !inPublicGroup) {
            router.replace('/login');
            return;
        }

        // 2. If logged in and on a public page -> Send to Dashboard
        if (session && inPublicGroup) {
            const role = session.user?.user_metadata?.role;
            if (role === 'provider') {
                router.replace('/provider');
            } else {
                router.replace('/diaspora');
            }
        }
    }, [router, segments, session, isMounted, loading]);

    if (!isMounted || loading) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={theme.colors.active} />
            </View>
        );
    }

    return (
        <Stack>
            {/* Public Routes */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />

            {/* Protected Routes */}
            <Stack.Screen name="diaspora" options={{ headerShown: false }} />
            <Stack.Screen name="provider" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />

            {/* Shared/Modal Routes */}
            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Info' }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack>
    );
}

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <LanguageProvider>
                <AuthProvider>
                    <GlobalProvider>
                        <InitialLayout />
                    </GlobalProvider>
                </AuthProvider>
            </LanguageProvider>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
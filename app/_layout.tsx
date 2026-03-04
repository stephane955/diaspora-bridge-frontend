import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function InitialLayout() {
    const { session, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    // --- ACTIVATE NOTIFICATIONS ---
    // Deep-link: When notification is tapped, route by action (Approve → project with modal; else chat)
    usePushNotifications((data) => {
        const id = (data.project_id ?? data.chat_id ?? data.id) as string | undefined;
        if (!id || typeof id !== 'string') return;
        const openApproval = data.openApproval === true || data.openApproval === '1' || data.actionIdentifier === 'APPROVE';
        if (openApproval) {
            router.push(`/diaspora/project/${id}?openApproval=1`);
        } else {
            router.push(`/chat/${id}`);
        }
    });

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
            segments[0] === 'signup' ||
            segments[0] === 'observer';

        // 1. If NOT logged in and trying to access a private page -> Send to Login
        if (!session && !inPublicGroup) {
            router.replace('/login');
            return;
        }

        // 2. If logged in and on a public page -> Send to Dashboard (role from AuthContext = Supabase auth metadata)
        if (session && inPublicGroup) {
            const r = session.user?.user_metadata?.role ?? session.user?.raw_user_meta_data?.role;
            if (r === 'provider') {
                router.replace('/provider');
            } else {
                router.replace('/diaspora');
            }
        }
    }, [router, segments, session, isMounted, loading]);

    if (!isMounted || loading) {
        return <SplashPlaceholder />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            {/* Public Routes */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />

            {/* Protected Routes */}
            <Stack.Screen name="diaspora" options={{ headerShown: false }} />
            <Stack.Screen name="provider" options={{ headerShown: false }} />

            {/* Shared/Modal Routes */}
            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Info' }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack>
    );
}

function SplashPlaceholder() {
    const { theme } = useTheme();
    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.active, opacity: 0.6 }} />
        </View>
    );
}

function RootContent() {
    const { isDark } = useTheme();
    return (
        <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <LanguageProvider>
                <AuthProvider>
                    <GlobalProvider>
                        <InitialLayout />
                    </GlobalProvider>
                </AuthProvider>
            </LanguageProvider>
            <StatusBar style={isDark ? 'light' : 'auto'} />
        </NavThemeProvider>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <RootContent />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
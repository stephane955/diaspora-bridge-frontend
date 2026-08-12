import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import 'react-native-reanimated';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '@/tamagui.config';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { QueryProvider } from '@/context/QueryProvider';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { resolveAccountRole } from '@/lib/resolveAccountRole';
import { usePremiumColors } from '@/hooks/usePremiumColors';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

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

        // 2. If logged in and on a public page -> Send to Dashboard (role from metadata + profiles)
        if (session && inPublicGroup) {
            resolveAccountRole(session.user).then((r) => {
                if (r === 'provider') router.replace('/provider');
                else if (r === 'supplier') router.replace('/supplier');
                else if (r === 'client') router.replace('/diaspora');
                else router.replace('/login');
            });
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
            <Stack.Screen name="supplier" options={{ headerShown: false }} />
            <Stack.Screen name="workroom/[id]" options={{ headerShown: false }} />

            {/* Shared/Modal Routes */}
            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Info' }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack>
    );
}

function SplashPlaceholder() {
    const c = usePremiumColors();
    return (
        <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.gold, opacity: 0.6 }} />
        </View>
    );
}

function RootContent() {
    const { isDark } = useTheme();
    return (
        <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <QueryProvider>
                <LanguageProvider>
                    <AuthProvider>
                        <GlobalProvider>
                            <InitialLayout />
                        </GlobalProvider>
                    </AuthProvider>
                </LanguageProvider>
            </QueryProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
        </NavThemeProvider>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <TamaguiThemeBridge>
                    <RootContent />
                </TamaguiThemeBridge>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

function TamaguiThemeBridge({ children }: { children: React.ReactNode }) {
    const { isDark } = useTheme();
    return (
        <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
            {children}
        </TamaguiProvider>
    );
}
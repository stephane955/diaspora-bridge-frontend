import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/context/LanguageContext';

function InitialLayout() {
    const { session } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        const inPublicGroup = segments[0] === 'login' || segments[0] === 'signup' || segments[0] === 'index';

        if (!session && !inPublicGroup) {
            router.replace('/login');
            return;
        }

        if (session && inPublicGroup) {
            const role = session.user?.user_metadata?.role;
            if (role === 'provider') {
                router.replace('/provider');
            } else {
                router.replace('/diaspora');
            }
        }
    }, [router, segments, session]);

    return (
        <Stack>
            {/* Public Routes */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />

            {/* Protected Routes */}
            <Stack.Screen name="diaspora" options={{ headerShown: false }} />
            <Stack.Screen name="provider" options={{ headerShown: false }} />

            {/* Shared/Modal Routes */}
            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
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

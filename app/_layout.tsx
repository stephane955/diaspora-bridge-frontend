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
    const { isAuthenticated, user, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        // 1. Identify where the user currently is
        const inProviderGroup = segments[0] === 'provider';
        const inClientGroup = segments[0] === 'diaspora';
        const inAuthGroup = inProviderGroup || inClientGroup;

        if (isAuthenticated && user) {
            // 2. Identify who the user IS
            const role = user.user_metadata?.role;
            console.log("User Role detected:", role); // Check your terminal logs!

            if (role === 'provider') {
                // If you are a Provider but NOT in the Provider Dashboard...
                if (!inProviderGroup) {
                    // Force redirect to Provider Hub
                    router.replace('/provider');
                }
            } else {
                // If you are a Client (or undefined role) but NOT in Client Dashboard...
                if (!inClientGroup) {
                    // Force redirect to Client Dashboard
                    router.replace('/diaspora');
                }
            }
        } else if (!isAuthenticated && inAuthGroup) {
            // 3. If not logged in but trying to see dashboards -> Login
            router.replace('/login');
        }
    }, [isAuthenticated, loading, segments, user]);

    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />

            {/* Protect these routes */}
            <Stack.Screen name="diaspora" options={{ headerShown: false }} />
            <Stack.Screen name="provider" options={{ headerShown: false }} />

            <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Info' }} />
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
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GlobalProvider } from '@/context/GlobalContext';
import { LanguageProvider } from '@/context/LanguageContext';

// 1. Create a "Protector" component inside the layout
function InitialLayout() {
    const { isAuthenticated, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        // Check if the user is in an "auth" group or a "public" screen
        const inAuthGroup = segments[0] === 'diaspora' || segments[0] === 'provider';

        if (isAuthenticated && !inAuthGroup) {
            // If logged in but on login/signup, go to dashboard
            // Note: You might need logic here to decide between diaspora/provider
            router.replace('/diaspora');
        } else if (!isAuthenticated && inAuthGroup) {
            // If logged out but trying to access dashboard, force login
            router.replace('/login');
        }
    }, [isAuthenticated, loading, segments]);

    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="diaspora" options={{ headerShown: false }} />
            <Stack.Screen name="provider" options={{ headerShown: false }} />
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
                        {/* 2. Use the Protector component here */}
                        <InitialLayout />
                    </GlobalProvider>
                </AuthProvider>
            </LanguageProvider>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
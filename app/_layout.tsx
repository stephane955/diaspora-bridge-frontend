import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GlobalProvider } from '@/context/GlobalContext';

export const unstable_settings = {
    anchor: '(tabs)',
};

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {/* 2. WRAP EVERYTHING IN THE BRAIN */}
            <GlobalProvider>
                <Stack>

                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />


                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />

                    <Stack.Screen name="diaspora" options={{ headerShown: false }} />
                    <Stack.Screen name="provider" options={{ headerShown: false }} />
                </Stack>
            </GlobalProvider>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
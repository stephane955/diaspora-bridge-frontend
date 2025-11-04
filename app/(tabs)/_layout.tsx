import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
                {/* landing */}
                <Stack.Screen name="index" options={{ title: 'Home' }} />

                {/* auth */}
                <Stack.Screen name="login" options={{ title: 'Login' }} />
                <Stack.Screen name="signup" options={{ title: 'Sign up' }} />

                {/* choose role after login */}
                <Stack.Screen name="role" options={{ title: 'Choose Role' }} />

                {/* app areas */}
                <Stack.Screen name="diaspora/index" options={{ title: 'Diaspora Home' }} />
                <Stack.Screen name="provider/index" options={{ title: 'Provider Home' }} />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}

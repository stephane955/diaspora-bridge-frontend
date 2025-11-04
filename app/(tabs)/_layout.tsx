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
                {/* start here */}
                <Stack.Screen name="login" options={{ title: 'Login' }} />
                <Stack.Screen name="role" options={{ title: 'Choose Role' }} />

                {/* diaspora home */}
                <Stack.Screen name="diaspora/index" options={{ title: 'Diaspora Home' }} />

                {/* provider home */}
                <Stack.Screen name="provider/index" options={{ title: 'Provider Home' }} />

                {/* you can keep the old modal if you want */}
                {/* <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} /> */}
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}

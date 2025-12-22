import { Stack, useRouter, Slot } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native'; // Import these
import { useAuth } from '@/context/AuthContext';

export default function DiasporaLayout() {
    // Assuming your useAuth returns an 'isLoading' or 'loading' property
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, loading]);

    // Show a spinner while Supabase connects
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0EA5E9" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="new" options={{ title: 'New Project', headerShown: true }} />
            <Stack.Screen name="project/[id]" />
            <Stack.Screen name="projects" options={{ title: 'My Projects', headerShown: true }} />
            <Stack.Screen name="timeline" />
        </Stack>
    );
}
// app/provider/_layout.tsx
import { Stack } from 'expo-router';

export default function ProviderLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'My Requests' }} />
            {/* later: earnings, project details, etc. */}
        </Stack>
    );
}

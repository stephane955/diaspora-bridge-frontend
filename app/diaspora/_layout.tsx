// app/diaspora/_layout.tsx
import { Stack } from 'expo-router';

export default function DiasporaLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ title: 'Diaspora Home' }} />
            <Stack.Screen name="new" options={{ title: 'New Project' }} />
            {/* later: provider/[id] */}
            {/* <Stack.Screen name="provider/[id]" options={{ title: 'Provider' }} /> */}
        </Stack>
    );
}

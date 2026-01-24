import { Tabs } from 'expo-router';
import ProviderNavigation from '@/components/ProviderNavigation';

export default function ProviderLayout() {
    return (
        <Tabs
            tabBar={() => <ProviderNavigation />}
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' }, // Completely hide the default white bar
            }}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="active" />
            <Tabs.Screen name="requests" />
            <Tabs.Screen name="earnings" />

            {/* Hidden Utility Screens */}
            <Tabs.Screen name="job/[id]" options={{ href: null }} />
            <Tabs.Screen name="request-payout" options={{ href: null }} />
            <Tabs.Screen name="post_update" options={{ href: null }} />
            <Tabs.Screen name="withdraw" options={{ href: null }} />
            <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
    );
}
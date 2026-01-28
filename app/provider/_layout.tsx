import { Tabs } from 'expo-router';
import ProviderNavigation from '@/components/ProviderNavigation';

export default function ProviderLayout() {
    return (
        <Tabs
            tabBar={() => <ProviderNavigation />}
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' }, // We use the custom ProviderNavigation below
            }}
        >
            {/* --- THE 5 MAIN TABS --- */}
            <Tabs.Screen name="index" />      {/* Tab 1: Hub (Dashboard) */}
            <Tabs.Screen name="market" />     {/* Tab 2: Find Work */}
            <Tabs.Screen name="active" />     {/* Tab 3: My Sites (Active & Applied) */}
            <Tabs.Screen name="earnings" />   {/* Tab 4: Wallet */}
            <Tabs.Screen name="profile" />    {/* Tab 5: Identity */}

            {/* --- HIDDEN SCREENS (Navigated to, but not tabs) --- */}
            <Tabs.Screen name="job/[id]" options={{ href: null }} />
            <Tabs.Screen name="project/[id]" options={{ href: null }} />
            <Tabs.Screen name="post_update" options={{ href: null }} />
            <Tabs.Screen name="payout-setup" options={{ href: null }} />
            <Tabs.Screen name="verification" options={{ href: null }} />
            <Tabs.Screen name="request-payout" options={{ href: null }} />

            {/* Ignored/Deprecated files (Hide them to prevent errors) */}
            <Tabs.Screen name="home" options={{ href: null }} />
            <Tabs.Screen name="withdraw" options={{ href: null }} />
            <Tabs.Screen name="requests" options={{ href: null }} />
        </Tabs>
    );
}
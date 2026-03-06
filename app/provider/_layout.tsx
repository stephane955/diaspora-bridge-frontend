import React from 'react';
import { Tabs } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import GlassTabBar from '@/components/GlassTabBar';
import { theme } from '@/constants/theme';

// All .tsx screens under app/provider/ (except _layout) must be listed here.
// Only index, market, active, earnings, profile are visible in the tab bar; all others get href: null.

export default function ProviderLayout() {
    const { t } = useLanguage();

    return (
        <Tabs
            tabBar={(props) => <GlassTabBar {...props} theme="dark" />}
            screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: theme.colors.surface,
                headerTitleStyle: { fontWeight: '700', fontSize: 18 },
                headerTitleAlign: 'center',
                headerShadowVisible: false,
                sceneContainerStyle: { backgroundColor: theme.colors.background },
                tabBarStyle: { display: 'none' },
            }}
        >
            {/* === VISIBLE IN GLASS TAB BAR === */}
            <Tabs.Screen name="index" options={{ title: t('providerDashboardTitle') ?? 'Home' }} />
            <Tabs.Screen name="inbox" options={{ title: t('inboxTitle') ?? 'Inbox' }} />
            <Tabs.Screen name="market" options={{ title: t('marketTitle') ?? 'Market' }} />
            <Tabs.Screen name="active" options={{ title: t('tabActive') ?? 'Sites' }} />
            <Tabs.Screen name="earnings" options={{ title: t('walletTitle') ?? 'Wallet' }} />
            <Tabs.Screen name="profile" options={{ title: t('tabProfile') ?? 'Profile' }} />

            {/* === HIDDEN (href: null) — every other file in app/provider/ === */}
            <Tabs.Screen name="requests" options={{ href: null, title: 'Requests' }} />
            <Tabs.Screen name="settings" options={{ href: null, title: t('settingsTitle') ?? 'Settings' }} />
            <Tabs.Screen name="payout-setup" options={{ href: null, title: 'Payout Setup' }} />
            <Tabs.Screen name="verification" options={{ href: null, title: t('verifyTitle') ?? 'Verification' }} />
            <Tabs.Screen name="post_update" options={{ href: null, title: 'Post Update' }} />
            <Tabs.Screen name="withdraw" options={{ href: null, title: t('withdrawTitle') ?? 'Withdraw' }} />
            <Tabs.Screen name="request-payout" options={{ href: null, title: 'Request Payout' }} />
            <Tabs.Screen name="suppliers" options={{ href: null, title: 'Partner Suppliers' }} />
            <Tabs.Screen name="material-cart" options={{ href: null, title: 'Material Cart' }} />
            <Tabs.Screen name="job/[id]" options={{ href: null, title: '' }} />
            <Tabs.Screen name="project/[id]" options={{ href: null, title: '' }} />
        </Tabs>
    );
}

import React from 'react';
import { Tabs } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import GlassTabBar from '@/components/GlassTabBar';
import { theme } from '@/constants/theme';

// All .tsx screens under app/diaspora/ (except _layout) must be listed here.
// Only index, inbox, wallet, market, profile are visible in the tab bar; all others get href: null.

export default function DiasporaLayout() {
    const { t } = useLanguage();

    return (
        <Tabs
            tabBar={(props) => <GlassTabBar {...props} theme="light" />}
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
            {/* === VISIBLE IN GLASS TAB BAR (5 only) === */}
            <Tabs.Screen name="index" options={{ title: t('tabHome') ?? 'Home' }} />
            <Tabs.Screen name="inbox" options={{ title: t('inboxTitle') ?? 'Inbox' }} />
            <Tabs.Screen name="wallet" options={{ title: t('clientDashboard.myWallet') ?? 'Wallet' }} />
            <Tabs.Screen name="market" options={{ title: t('marketTitle') ?? 'Market' }} />
            <Tabs.Screen name="profile" options={{ title: t('tabProfile') ?? 'Profile' }} />

            {/* === HIDDEN (href: null) — every other file in app/diaspora/ === */}
            <Tabs.Screen name="menu" options={{ href: null, title: t('menuTitle') ?? 'Menu' }} />
            <Tabs.Screen name="settings" options={{ href: null, title: t('menuSettings') ?? 'Settings' }} />
            <Tabs.Screen name="new" options={{ href: null, title: t('tabPostJob') ?? 'New Project' }} />
            <Tabs.Screen name="projects" options={{ href: null, title: t('tabProjects') ?? 'Projects' }} />
            <Tabs.Screen name="timeline" options={{ href: null, title: 'Timeline' }} />
            <Tabs.Screen name="project/[id]" options={{ href: null, title: '' }} />
            <Tabs.Screen name="project/proposals" options={{ href: null, title: 'Proposals' }} />
            <Tabs.Screen name="project/[id]/applicants" options={{ href: null, title: t('applicantsTitle') ?? 'Applicants' }} />
        </Tabs>
    );
}

import React from 'react';
import { Tabs } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import GlassTabBar from '@/components/GlassTabBar';
import { usePremiumColors } from '@/hooks/usePremiumColors';

export default function DiasporaLayout() {
    const { t } = useLanguage();
    const c = usePremiumColors();

    return (
        <Tabs
            tabBar={(props) => <GlassTabBar {...props} role="client" />}
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: c.bg },
                tabBarStyle: { display: 'none' },
            }}
        >
            <Tabs.Screen name="index" options={{ title: t('tabHome') ?? 'Home' }} />
            <Tabs.Screen name="wallet" options={{ title: 'Escrow Carts' }} />
            <Tabs.Screen name="inbox" options={{ title: t('inboxTitle') ?? 'Messages' }} />
            <Tabs.Screen name="profile" options={{ title: t('tabProfile') ?? 'Profile' }} />

            <Tabs.Screen name="menu" options={{ href: null, title: t('menuTitle') ?? 'Menu' }} />
            <Tabs.Screen name="settings" options={{ href: null, title: t('menuSettings') ?? 'Settings' }} />
            <Tabs.Screen name="new" options={{ href: null, title: t('tabPostJob') ?? 'New Project' }} />
            <Tabs.Screen name="projects" options={{ href: null, title: t('tabProjects') ?? 'Projects' }} />
            <Tabs.Screen name="timeline" options={{ href: null, title: 'Timeline' }} />
            <Tabs.Screen name="market" options={{ href: null, title: t('marketTitle') ?? 'Market' }} />
            <Tabs.Screen name="project/[id]" options={{ href: null, title: '' }} />
            <Tabs.Screen name="project/proposals" options={{ href: null, title: 'Proposals' }} />
            <Tabs.Screen name="project/[id]/applicants" options={{ href: null, title: t('applicantsTitle') ?? 'Applicants' }} />
            <Tabs.Screen name="saved-providers" options={{ href: null, title: t('savedProviders') ?? 'Saved Providers' }} />
        </Tabs>
    );
}

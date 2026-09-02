import React from 'react';
import { Tabs } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import GlassTabBar from '@/components/GlassTabBar';
import { usePremiumColors } from '@/hooks/usePremiumColors';

export default function ProviderLayout() {
    const { t } = useLanguage();
    const c = usePremiumColors();

    return (
        <Tabs
            tabBar={(props) => <GlassTabBar {...props} role="provider" />}
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: c.bg },
                tabBarStyle: { display: 'none' },
            }}
        >
            <Tabs.Screen name="active" options={{ title: t('tabActive') ?? 'Active Sites' }} />
            <Tabs.Screen name="cart-hub" options={{ title: t('cartHubTitle') ?? 'Cart & Scan' }} />
            <Tabs.Screen name="inbox" options={{ title: t('inboxTitle') ?? 'Messages' }} />
            <Tabs.Screen name="profile" options={{ title: t('tabProfile') ?? 'Profile' }} />

            <Tabs.Screen name="index" options={{ href: null, title: t('providerDashboardTitle') ?? 'Home' }} />
            <Tabs.Screen name="market" options={{ href: null, title: t('marketTitle') ?? 'Market' }} />
            <Tabs.Screen name="earnings" options={{ href: null, title: t('walletTitle') ?? 'Wallet' }} />
            <Tabs.Screen name="requests" options={{ href: null, title: t('requestsTitle') ?? 'Requests' }} />
            <Tabs.Screen name="settings" options={{ href: null, title: t('settingsTitle') ?? 'Settings' }} />
            <Tabs.Screen name="payout-setup" options={{ href: null, title: t('payoutSetupTitle') ?? 'Payout Setup' }} />
            <Tabs.Screen name="verification" options={{ href: null, title: t('verifyTitle') ?? 'Verification' }} />
            <Tabs.Screen name="post_update" options={{ href: null, title: t('postUpdateTitle') ?? 'Post Update' }} />
            <Tabs.Screen name="withdraw" options={{ href: null, title: t('withdrawTitle') ?? 'Withdraw' }} />
            <Tabs.Screen name="request-payout" options={{ href: null, title: t('requestPayoutTitle') ?? 'Request Payout' }} />
            <Tabs.Screen name="suppliers" options={{ href: null, title: t('partnerSuppliersTitle') ?? 'Partner Suppliers' }} />
            <Tabs.Screen name="material-cart" options={{ href: null, title: t('materialCartTitle') ?? 'Material Cart' }} />
            <Tabs.Screen name="job/[id]" options={{ href: null, title: '' }} />
            <Tabs.Screen name="project/[id]" options={{ href: null, title: '' }} />
            <Tabs.Screen name="verification-scan" options={{ href: null, title: t('scanDocument') ?? 'Scan' }} />
            <Tabs.Screen name="add-receipt" options={{ href: null, title: t('receipt') ?? 'Receipt' }} />
        </Tabs>
    );
}

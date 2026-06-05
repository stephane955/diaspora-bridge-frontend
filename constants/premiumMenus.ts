import type { Router } from 'expo-router';
import type { PremiumMenuItem } from '@/components/PremiumHeader';
import type { translations } from '@/constants/translations';

type Translate = (key: keyof typeof translations.en) => string;

export function clientMenuItems(router: Router, t: Translate): PremiumMenuItem[] {
  return [
    { label: t('clientDashboard.activeProjects'), onPress: () => router.push('/diaspora/projects') },
    { label: t('newProjectTitle'), onPress: () => router.push('/diaspora/new') },
    { label: t('clientDashboard.myWallet'), onPress: () => router.push('/diaspora/wallet') },
    { label: t('settingsTitle'), icon: 'settings', onPress: () => router.push('/diaspora/settings') },
    { label: t('tabProfile'), icon: 'profile', onPress: () => router.push('/diaspora/profile') },
  ];
}

export function providerMenuItems(router: Router, t: Translate): PremiumMenuItem[] {
  return [
    { label: t('tabActive'), onPress: () => router.push('/provider/active') },
    { label: t('cartHubTitle'), onPress: () => router.push('/provider/cart-hub') },
    { label: t('marketTitle'), onPress: () => router.push('/provider/market') },
    { label: t('requestsTab'), onPress: () => router.push('/provider/requests') },
    { label: t('walletTitle'), onPress: () => router.push('/provider/earnings') },
    { label: t('settingsTitle'), icon: 'settings', onPress: () => router.push('/provider/settings') },
    { label: t('tabProfile'), icon: 'profile', onPress: () => router.push('/provider/profile') },
  ];
}

import type { Router } from 'expo-router';
import type { PremiumMenuItem } from '@/components/PremiumHeader';
import type { UserRole } from '@/context/AuthContext';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function clientMenuItems(router: Router, t: Translate): PremiumMenuItem[] {
  return [
    { label: t('clientDashboard.activeProjects'), icon: 'projects', onPress: () => router.push('/diaspora/projects') },
    { label: t('savedProviders'), icon: 'saved', onPress: () => router.push('/diaspora/saved-providers') },
    { label: t('newProjectTitle'), icon: 'new', onPress: () => router.push('/diaspora/new') },
    { label: t('clientDashboard.myWallet'), icon: 'wallet', onPress: () => router.push('/diaspora/wallet') },
    { label: t('settingsTitle'), icon: 'settings', onPress: () => router.push('/diaspora/settings') },
    { label: t('tabProfile'), icon: 'profile', onPress: () => router.push('/diaspora/profile') },
  ];
}

export function providerMenuItems(router: Router, t: Translate): PremiumMenuItem[] {
  return [
    { label: t('tabActive'), icon: 'home', onPress: () => router.push('/provider/active') },
    { label: t('cartHubTitle'), icon: 'cart', onPress: () => router.push('/provider/cart-hub') },
    { label: t('marketTitle'), icon: 'market', onPress: () => router.push('/provider/market') },
    { label: t('requestsTab'), icon: 'requests', onPress: () => router.push('/provider/requests') },
    { label: t('walletTitle'), icon: 'wallet', onPress: () => router.push('/provider/earnings') },
    { label: t('settingsTitle'), icon: 'settings', onPress: () => router.push('/provider/settings') },
    { label: t('tabProfile'), icon: 'profile', onPress: () => router.push('/provider/profile') },
  ];
}

export function supplierMenuItems(router: Router, t: Translate): PremiumMenuItem[] {
  return [
    { label: t('ordersTitle') || 'Orders', icon: 'projects', onPress: () => router.push('/supplier/dashboard') },
    { label: t('scanCollection') || 'Scan collection', icon: 'scan', onPress: () => router.push('/supplier/scanner') },
  ];
}

/** The one menu for the signed-in role. PremiumHeader uses this when a screen does not pass `menuItems`. */
export function roleMenuItems(role: UserRole, router: Router, t: Translate): PremiumMenuItem[] {
  if (role === 'provider') return providerMenuItems(router, t);
  if (role === 'supplier') return supplierMenuItems(router, t);
  return clientMenuItems(router, t);
}

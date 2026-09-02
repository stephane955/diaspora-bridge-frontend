import React from 'react';
import { Tabs } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import GlassTabBar from '@/components/GlassTabBar';
import { usePremiumColors } from '@/hooks/usePremiumColors';

export default function SupplierLayout() {
  const { t } = useLanguage();
  const c = usePremiumColors();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} role="supplier" />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: t('ordersTitle') ?? 'Orders' }} />
      <Tabs.Screen name="scanner" options={{ title: t('scanCollection') ?? 'Scan' }} />
      <Tabs.Screen name="index" options={{ href: null, title: 'Home' }} />
    </Tabs>
  );
}

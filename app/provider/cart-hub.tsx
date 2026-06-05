import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingCart, ScanLine, Camera, ChevronRight } from 'lucide-react-native';
import PremiumHeader from '@/components/PremiumHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { providerMenuItems } from '@/constants/premiumMenus';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_GOLD } from '@/constants/layout';
import { mediumFeedback } from '@/utils/haptics';

export default function CartHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const ACTIONS = [
    {
      key: 'cart',
      title: t('createCart'),
      subtitle: t('createCartSub'),
      icon: ShoppingCart,
      colors: ['#10B981', '#059669'] as [string, string],
      route: '/provider/active' as const,
    },
    {
      key: 'scan',
      title: t('scanQR'),
      subtitle: t('scanQRSub'),
      icon: ScanLine,
      colors: ['#2563EB', '#1D4ED8'] as [string, string],
      route: '/provider/verification-scan' as const,
    },
    {
      key: 'photo',
      title: t('takePhoto'),
      subtitle: t('takePhotoSub'),
      icon: Camera,
      colors: ['#D4AF37', '#B8860B'] as [string, string],
      route: '/provider/active' as const,
    },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <PremiumHeader
        title={t('cartHubTitle')}
        subtitle={t('cartHubQuickActionsSub')}
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 88,
          paddingHorizontal: 20,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroTitle}>{t('cartHubQuickActions')}</Text>
        <Text style={styles.heroSub}>{t('cartHubQuickActionsSub')}</Text>

        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <TouchableOpacity
              key={action.key}
              activeOpacity={0.92}
              onPress={() => {
                mediumFeedback();
                router.push(action.route);
              }}
            >
              <BlurView intensity={40} tint="dark" style={styles.actionCard}>
                <LinearGradient colors={action.colors} style={styles.actionIcon}>
                  <Icon size={26} color="#fff" strokeWidth={2.2} />
                </LinearGradient>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSub}>{action.subtitle}</Text>
                </View>
                <ChevronRight size={22} color={PREMIUM_GOLD} />
              </BlurView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PREMIUM_BG,
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17,24,39,0.6)',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  actionSub: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
});

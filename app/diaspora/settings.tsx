import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { successFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import ThemeToggleRow from '@/components/ThemeToggleRow';
import SettingsSection from '@/components/settings/SettingsSection';
import SettingsRow from '@/components/settings/SettingsRow';
import { clientMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { FLOATING_TAB_BAR_HEIGHT } from '@/constants/layout';
import {
  ALPHA,
  GOLD,
  INFO,
  NAVY,
  SUCCESS,
  WARNING,
  radius,
  space,
  text,
  weight,
  withAlpha,
} from '@/constants/design';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

export default function ClientSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, setLanguage, language } = useLanguage();
  const { signOut } = useAuth();
  const c = usePremiumColors();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const currentLang = LANGUAGES.find((l) => l.code === language);

  const cycleLanguage = () => {
    const currentIndex = LANGUAGES.findIndex((l) => l.code === language);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    setLanguage(LANGUAGES[nextIndex].code as any);
    successFeedback();
  };

  const handleSignOut = () => {
    Alert.alert(t('signOut'), t('signOutConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          successFeedback();
          await signOut();
        },
      },
    ]);
  };

  const openSupport = () => {
    successFeedback();
    Linking.openURL('mailto:support@diasporabridge.app?subject=Client%20Support');
  };

  const openLegal = () => {
    successFeedback();
    Alert.alert(
      t('legal') || 'Legal',
      t('legalBody') ||
        'Terms of Service and Privacy Policy are available on our website. Contact support for a copy.',
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <PremiumHeader
        title={t('menuSettings')}
        subtitle={t('accountSettings')}
        showBack
        fallbackRoute="/diaspora"
        menuItems={clientMenuItems(router, t)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 88,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + 48,
          paddingHorizontal: space.lg,
        }}
      >
        <LinearGradient
          colors={[withAlpha(NAVY, 0.92), withAlpha('#1E293B', 0.85)]}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>{t('accountSettings')}</Text>
          <Text style={styles.heroSub}>
            Manage appearance, language, notifications, and account security.
          </Text>
        </LinearGradient>

        <SettingsSection title={t('preferences') ?? 'Preferences'}>
          <ThemeToggleRow embedded />
          <SettingsRow
            showDivider
            icon="globe-outline"
            iconColor={INFO}
            iconBg={withAlpha(INFO, ALPHA.medium)}
            title={t('languageName') ?? 'Language'}
            subtitle={`${currentLang?.flag ?? ''} ${currentLang?.label ?? 'English'}`}
            onPress={cycleLanguage}
          />
          <SettingsRow
            showDivider
            icon="notifications-outline"
            iconColor={WARNING}
            iconBg={withAlpha(WARNING, ALPHA.medium)}
            title={t('notifications') ?? 'Notifications'}
            subtitle={t('pushNotifs') ?? 'Push notifications'}
            switchValue={notificationsEnabled}
            onSwitchChange={setNotificationsEnabled}
            switchTrackOn={withAlpha(WARNING, 0.45)}
          />
        </SettingsSection>

        <SettingsSection title={t('general') ?? 'General'}>
          <SettingsRow
            icon="person-circle-outline"
            iconColor={GOLD}
            iconBg={withAlpha(GOLD, ALPHA.medium)}
            title={t('tabProfile') ?? 'Profile'}
            subtitle="Edit name, city, and account details"
            onPress={() => router.push('/diaspora/profile')}
          />
          <SettingsRow
            showDivider
            icon="help-buoy-outline"
            iconColor={SUCCESS}
            iconBg={withAlpha(SUCCESS, ALPHA.medium)}
            title={t('support') ?? 'Support'}
            subtitle="support@diasporabridge.app"
            onPress={openSupport}
          />
          <SettingsRow
            showDivider
            icon="document-text-outline"
            iconColor={c.textSecondary}
            iconBg={withAlpha(c.textSecondary, ALPHA.faint)}
            title={t('legal') ?? 'Legal'}
            subtitle="Terms · Privacy"
            onPress={openLegal}
          />
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingsRow
            icon="log-out-outline"
            iconColor="#F87171"
            iconBg="rgba(248,113,113,0.18)"
            title={t('signOut') ?? 'Log Out'}
            subtitle="Sign out on this device"
            destructive
            onPress={handleSignOut}
          />
        </SettingsSection>

        <Text style={[styles.version, { color: c.muted }]}>{t('version') ?? 'Version 1.0.0'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: {
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.xl,
    borderWidth: 1,
    borderColor: withAlpha(GOLD, ALPHA.medium),
  },
  heroTitle: {
    ...text.title,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: space.xxs,
  },
  heroSub: {
    ...text.caption,
    color: withAlpha('#FFFFFF', 0.72),
    lineHeight: 20,
  },
  version: {
    ...text.caption,
    textAlign: 'center',
    marginTop: space.xl,
    fontWeight: weight.semibold,
  },
});

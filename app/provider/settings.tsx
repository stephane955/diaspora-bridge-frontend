import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import ThemeToggleRow from '@/components/ThemeToggleRow';
import SettingsSection from '@/components/settings/SettingsSection';
import SettingsRow from '@/components/settings/SettingsRow';
import { providerMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { successFeedback } from '@/utils/haptics';
import { FLOATING_TAB_BAR_HEIGHT } from '@/constants/layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const ONLINE_STORAGE_KEY = 'provider_is_online';

const LANGUAGES = [
  { code: 'en' as const, label: 'English', flag: '🇺🇸' },
  { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
  { code: 'es' as const, label: 'Español', flag: '🇪🇸' },
  { code: 'de' as const, label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it' as const, label: 'Italiano', flag: '🇮🇹' },
];

export default function ProviderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, setLanguage, language } = useLanguage();
  const c = usePremiumColors();

  const [isOnline, setIsOnline] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profile, setProfile] = useState<{
    full_name?: string | null;
    city?: string | null;
    avatar_url?: string | null;
  } | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, city, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
    }
    try {
      const stored = await AsyncStorage.getItem(ONLINE_STORAGE_KEY);
      if (stored === 'true' || stored === 'false') {
        setIsOnline(stored === 'true');
      }
    } catch {
      // keep default local UI state
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    t('providerFallback');
  const accountEmail = user?.email ?? '';

  const currentLang = LANGUAGES.find((l) => l.code === language);

  const toggleOnline = async (value: boolean) => {
    setIsOnline(value);
    successFeedback();
    try {
      await AsyncStorage.setItem(ONLINE_STORAGE_KEY, value ? 'true' : 'false');
    } catch {
      setIsOnline(!value);
      Alert.alert(t('error'), t('connectionFailed'));
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('signOut'), t('signOutConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(t('deleteAccountTitle'), t('deleteAccountConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Contact Support',
            'Please contact support to delete provider accounts with active history.',
          ),
      },
    ]);
  };

  const cycleLanguage = () => {
    const currentIndex = LANGUAGES.findIndex((l) => l.code === language);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    setLanguage(LANGUAGES[nextIndex].code);
    successFeedback();
  };

  const openSupport = () => {
    successFeedback();
    Linking.openURL('mailto:support@diasporabridge.app?subject=Provider%20Support');
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
        title={t('settingsTitle')}
        subtitle={displayName}
        showBack
        fallbackRoute="/provider/active"
        menuItems={providerMenuItems(router, t)}
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
          colors={
            isOnline
              ? [withAlpha(NAVY, 0.95), withAlpha('#14532D', 0.55)]
              : [withAlpha('#475569', 0.95), withAlpha(NAVY, 0.85)]
          }
          style={styles.hero}
        >
          <View style={styles.identityRow}>
            <Image
              source={{
                uri: profile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id ?? 'provider'}`,
              }}
              style={styles.avatar}
            />
            <View style={styles.identityCopy}>
              <Text style={styles.heroName} numberOfLines={2}>{displayName}</Text>
              {accountEmail ? (
                <Text style={styles.heroEmail} numberOfLines={1}>{accountEmail}</Text>
              ) : null}
              {profile?.city ? (
                <View style={styles.cityRow}>
                  <Text style={styles.heroCity}>{profile.city}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.heroSub}>
            {isOnline
              ? 'You are visible to clients and can receive new job requests.'
              : 'You are offline — clients will not see you as available.'}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: withAlpha(isOnline ? SUCCESS : WARNING, ALPHA.medium) }]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? SUCCESS : WARNING }]} />
            <Text style={[styles.statusText, { color: isOnline ? SUCCESS : WARNING }]}>
              {isOnline ? t('onlineAvailable') : t('offlineStatus')}
            </Text>
          </View>
        </LinearGradient>

        <SettingsSection title="Your account">
          <SettingsRow
            icon="person-outline"
            iconColor={GOLD}
            iconBg={withAlpha(GOLD, ALPHA.medium)}
            title={t('nameLabel') || 'Full name'}
            subtitle={displayName}
          />
          {accountEmail ? (
            <SettingsRow
              showDivider
              icon="mail-outline"
              iconColor={INFO}
              iconBg={withAlpha(INFO, ALPHA.medium)}
              title={t('emailPlaceholder') || 'Email'}
              subtitle={accountEmail}
            />
          ) : null}
          {profile?.city ? (
            <SettingsRow
              showDivider
              icon="location-outline"
              iconColor={SUCCESS}
              iconBg={withAlpha(SUCCESS, ALPHA.medium)}
              title={t('cityLabel') || 'City'}
              subtitle={profile.city}
            />
          ) : null}
          <SettingsRow
            showDivider
            icon="create-outline"
            iconColor={c.textSecondary}
            iconBg={withAlpha(c.textSecondary, ALPHA.faint)}
            title={t('editProfile') || 'Edit profile'}
            subtitle="Update name, city, and bio"
            onPress={() => router.push('/provider/profile')}
          />
        </SettingsSection>

        <SettingsSection title={t('availability')}>
          <SettingsRow
            icon="power"
            iconColor={SUCCESS}
            iconBg={withAlpha(SUCCESS, ALPHA.medium)}
            title={t('onlineStatus')}
            subtitle={t('onlineDesc')}
            switchValue={isOnline}
            onSwitchChange={toggleOnline}
            switchTrackOn={withAlpha(SUCCESS, 0.45)}
          />
        </SettingsSection>

        <SettingsSection title={t('preferences')}>
          <ThemeToggleRow embedded />
          <SettingsRow
            showDivider
            icon="globe-outline"
            iconColor={INFO}
            iconBg={withAlpha(INFO, ALPHA.medium)}
            title={t('languageName')}
            subtitle={`${currentLang?.flag ?? ''} ${currentLang?.label ?? 'English'}`}
            onPress={cycleLanguage}
          />
          <SettingsRow
            showDivider
            icon="notifications-outline"
            iconColor={GOLD}
            iconBg={withAlpha(GOLD, ALPHA.medium)}
            title={t('notifications')}
            subtitle={t('pushNotifs')}
            switchValue={notificationsEnabled}
            onSwitchChange={(v) => {
              setNotificationsEnabled(v);
              successFeedback();
            }}
          />
        </SettingsSection>

        <SettingsSection title={t('general')}>
          <SettingsRow
            icon="person-circle-outline"
            iconColor={GOLD}
            iconBg={withAlpha(GOLD, ALPHA.medium)}
            title={t('tabProfile')}
            subtitle="Portfolio, reviews, and verification"
            onPress={() => router.push('/provider/profile')}
          />
          <SettingsRow
            showDivider
            icon="card-outline"
            iconColor={INFO}
            iconBg={withAlpha(INFO, ALPHA.medium)}
            title="Payout setup"
            subtitle="Mobile money and withdrawal details"
            onPress={() => router.push('/provider/payout-setup')}
          />
          <SettingsRow
            showDivider
            icon="help-buoy-outline"
            iconColor={SUCCESS}
            iconBg={withAlpha(SUCCESS, ALPHA.medium)}
            title={t('support')}
            subtitle="support@diasporabridge.app"
            onPress={openSupport}
          />
          <SettingsRow
            showDivider
            icon="document-text-outline"
            iconColor={c.textSecondary}
            iconBg={withAlpha(c.textSecondary, ALPHA.faint)}
            title={t('legal')}
            subtitle="Terms · Privacy"
            onPress={openLegal}
          />
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingsRow
            icon="log-out-outline"
            iconColor="#F87171"
            iconBg="rgba(248,113,113,0.18)"
            title={t('signOut')}
            subtitle="Sign out on this device"
            destructive
            onPress={handleSignOut}
          />
          <SettingsRow
            showDivider
            icon="trash-outline"
            iconColor={c.textSecondary}
            iconBg={withAlpha(c.textSecondary, ALPHA.faint)}
            title={t('deleteAccountTitle')}
            subtitle="Requires support verification"
            onPress={handleDelete}
          />
        </SettingsSection>

        <Text style={[styles.version, { color: c.muted }]}>{t('version')}</Text>
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
    gap: space.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xs,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: withAlpha(GOLD, 0.6),
    backgroundColor: withAlpha(NAVY, 0.5),
  },
  identityCopy: { flex: 1, gap: 2 },
  heroName: {
    ...text.title,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroEmail: {
    ...text.caption,
    color: withAlpha('#FFFFFF', 0.85),
    fontWeight: weight.semibold,
  },
  cityRow: { marginTop: 2 },
  heroCity: {
    ...text.caption,
    color: withAlpha('#FFFFFF', 0.72),
    fontWeight: weight.heavy,
  },
  heroSub: {
    ...text.caption,
    color: withAlpha('#FFFFFF', 0.72),
    lineHeight: 20,
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    marginTop: space.xxs,
  },
  statusDot: { width: 7, height: 7, borderRadius: radius.pill },
  statusText: { ...text.micro, fontWeight: weight.heavy },
  version: {
    ...text.caption,
    textAlign: 'center',
    marginTop: space.xl,
    fontWeight: weight.semibold,
  },
});

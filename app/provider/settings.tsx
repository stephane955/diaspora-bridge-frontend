import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import ThemeToggleRow from '@/components/ThemeToggleRow';
import {
  FLOATING_TAB_BAR_HEIGHT,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { successFeedback, mediumFeedback } from '@/utils/haptics';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

export default function ProviderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, setLanguage, language } = useLanguage();
  const c = usePremiumColors();

  const [isOnline, setIsOnline] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('is_online')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setIsOnline(data.is_online);
        });
    }
  }, [user]);

  const toggleOnline = async (value: boolean) => {
    setIsOnline(value);
    successFeedback();
    try {
      await supabase.from('profiles').update({ is_online: value }).eq('id', user?.id);
    } catch {
      setIsOnline(!value);
      Alert.alert(t('error'), t('connectionFailed'));
    }
  };

  const handleSignOut = async () => {
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
    mediumFeedback();
    const currentIndex = LANGUAGES.findIndex((l) => l.code === language);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    setLanguage(LANGUAGES[nextIndex].code as any);
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
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <PremiumHeader
        title={t('settingsTitle')}
        subtitle={t('preferences')}
        showBack
        fallbackRoute="/provider/active"
        menuItems={providerMenuItems(router, t)}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 88,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
            paddingHorizontal: 20,
          },
        ]}
      >
        <Text style={styles.sectionTitle}>{t('availability')}</Text>
        <BlurView intensity={36} tint="dark" style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIconBg, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <Ionicons name="power" size={20} color="#34D399" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('onlineStatus')}</Text>
              <Text style={styles.rowSub}>{t('onlineDesc')}</Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#334155', true: 'rgba(52,211,153,0.5)' }}
              thumbColor={isOnline ? '#34D399' : '#94A3B8'}
            />
          </View>
        </BlurView>

        <Text style={styles.sectionTitle}>{t('preferences')}</Text>
        <ThemeToggleRow />
        <BlurView intensity={36} tint="dark" style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={cycleLanguage}>
            <View style={[styles.rowIconBg, { backgroundColor: 'rgba(37,99,235,0.18)' }]}>
              <Ionicons name="globe-outline" size={20} color="#60A5FA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('languageName')}</Text>
              <Text style={styles.rowSub}>
                {LANGUAGES.find((l) => l.code === language)?.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={[styles.rowIconBg, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
              <Ionicons name="notifications-outline" size={20} color={PREMIUM_GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('notifications')}</Text>
              <Text style={styles.rowSub}>{t('pushNotifs')}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => {
                setNotificationsEnabled(v);
                successFeedback();
              }}
              trackColor={{ false: '#334155', true: 'rgba(212,175,55,0.45)' }}
              thumbColor={notificationsEnabled ? PREMIUM_GOLD : '#94A3B8'}
            />
          </View>
        </BlurView>

        <Text style={styles.sectionTitle}>{t('general')}</Text>
        <BlurView intensity={36} tint="dark" style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={openSupport}>
            <View style={[styles.rowIconBg, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Ionicons name="help-buoy-outline" size={20} color={TEXT_SECONDARY} />
            </View>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{t('support')}</Text>
            <Ionicons name="mail-outline" size={20} color={PREMIUM_GOLD} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={openLegal}>
            <View style={[styles.rowIconBg, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Ionicons name="document-text-outline" size={20} color={TEXT_SECONDARY} />
            </View>
            <Text style={[styles.rowTitle, { flex: 1 }]}>{t('legal')}</Text>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </BlurView>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <Text style={styles.logoutText}>{t('signOut')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteText}>{t('deleteAccountTitle')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{t('version')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_SECONDARY,
    marginBottom: 10,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17,24,39,0.7)',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  rowIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  rowSub: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 64,
  },
  logoutBtn: {
    marginTop: 28,
    backgroundColor: 'rgba(239,68,68,0.15)',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutText: { color: '#F87171', fontWeight: '800', fontSize: 16 },
  deleteBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
  deleteText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  versionText: {
    textAlign: 'center',
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 20,
  },
});

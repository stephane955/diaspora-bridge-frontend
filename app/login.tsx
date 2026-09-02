import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { PREMIUM_GOLD } from '@/constants/layout';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useLanguage } from '@/context/LanguageContext';
import { resolveAccountRole } from '@/lib/resolveAccountRole';
import { mediumFeedback, lightFeedback, successFeedback } from '@/utils/haptics';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePremiumColors();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'diaspora' | 'provider'>('diaspora');
  const [showPassword, setShowPassword] = useState(false);

  const handleClose = () => {
    lightFeedback();
    router.replace('/');
  };

  const switchRole = (role: 'diaspora' | 'provider') => {
    mediumFeedback();
    setActiveTab(role);
  };

  const onLogin = async () => {
    if (!email || !password) {
      return Alert.alert(t('errorTitle'), t('missingFields'));
    }

    mediumFeedback();
    setLoading(true);
    const expectedRole = activeTab === 'provider' ? 'provider' : 'client';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const accountRole = await resolveAccountRole(data.user);

      if (!accountRole) {
        await supabase.auth.signOut();
        Alert.alert(
          t('loginRoleRequiredTitle') || 'Role required',
          t('loginRoleRequiredBody') ||
            'This account has no role. Please sign up again as Client or Provider.',
        );
        return;
      }

      if (accountRole !== expectedRole) {
        await supabase.auth.signOut();
        Alert.alert(
          t('loginWrongRoleTitle') || 'Wrong portal',
          expectedRole === 'client'
            ? t('loginWrongRoleClient') ||
                'This account is a Provider. Switch to the Provider tab to sign in.'
            : t('loginWrongRoleProvider') ||
                'This account is a Client. Switch to the Client tab to sign in.',
        );
        return;
      }

      successFeedback();
      if (accountRole === 'provider') router.replace('/provider');
      else router.replace('/diaspora');
    } catch (err) {
      let message = err instanceof Error ? err.message : t('loginFailed') || 'Login failed.';
      if (/invalid login credentials/i.test(message)) {
        message =
          'No account found on the development server. Your old login was likely on production — please tap Create Account to sign up again (you can reuse the same email).';
      }
      Alert.alert(t('loginFailed') || 'Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('errorTitle'), t('emailPlaceholder'));
      return;
    }
    const redirectUrl = Linking.createURL('reset-password');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    setLoading(false);

    if (error) Alert.alert(t('errorTitle'), error.message);
    else Alert.alert(t('success'), `${t('checkEmail') || 'Check email'}: ${email}`);
  };

  const isDiaspora = activeTab === 'diaspora';

  return (
    <ImageBackground
      source={{
        uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop',
      }}
      style={styles.background}
    >
      <LinearGradient
        colors={
          c.isDark
            ? ['rgba(10, 15, 26, 0.55)', 'rgba(10, 15, 26, 0.94)']
            : ['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.88)']
        }
        style={styles.gradient}
      >
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={[styles.logoCircle, { borderColor: 'rgba(212,175,55,0.45)' }]}>
                <Ionicons name="business" size={32} color={PREMIUM_GOLD} />
              </View>
              <Text style={styles.brandName}>
                Diaspora
                <Text style={{ color: PREMIUM_GOLD }}>Bridge</Text>
              </Text>
              <Text style={styles.tagline}>{t('heroCta')}</Text>
            </View>

            <BlurView intensity={70} tint="dark" style={styles.card}>
              <View style={styles.roleToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    isDiaspora && styles.roleCardActive,
                    isDiaspora && { borderColor: PREMIUM_GOLD },
                  ]}
                  onPress={() => switchRole('diaspora')}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.roleIconCircle,
                      isDiaspora && { backgroundColor: PREMIUM_GOLD },
                    ]}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={24}
                      color={isDiaspora ? '#0A0F1A' : '#94A3B8'}
                    />
                  </View>
                  <Text style={[styles.roleLabel, isDiaspora && styles.roleLabelActive]}>
                    {t('roleClient')}
                  </Text>
                  <Text style={styles.roleDesc}>{t('clientHireHint') || 'I hire talent'}</Text>
                  {isDiaspora ? <View style={[styles.activeIndicator, { backgroundColor: PREMIUM_GOLD }]} /> : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    !isDiaspora && styles.roleCardActive,
                    !isDiaspora && { borderColor: PREMIUM_GOLD },
                  ]}
                  onPress={() => switchRole('provider')}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.roleIconCircle,
                      !isDiaspora && { backgroundColor: PREMIUM_GOLD },
                    ]}
                  >
                    <Ionicons
                      name="construct-outline"
                      size={24}
                      color={!isDiaspora ? '#0A0F1A' : '#94A3B8'}
                    />
                  </View>
                  <Text style={[styles.roleLabel, !isDiaspora && styles.roleLabelActive]}>
                    {t('roleProvider')}
                  </Text>
                  <Text style={styles.roleDesc}>{t('providerWorkHint') || 'I find work'}</Text>
                  {!isDiaspora ? (
                    <View style={[styles.activeIndicator, { backgroundColor: PREMIUM_GOLD }]} />
                  ) : null}
                </TouchableOpacity>
              </View>

              <Text style={styles.portalHint}>
                {isDiaspora
                  ? t('clientPortalOnly') || 'Client accounts only'
                  : t('providerPortalOnly') || 'Provider accounts only'}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('emailPlaceholder')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#94A3B8" style={{ marginLeft: 12 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('passwordPlaceholder')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#94A3B8"
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#64748B"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    style={{ paddingHorizontal: 12 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleResetPassword}
                style={styles.forgotBtn}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={styles.forgotText}>{t('forgotPassword') || 'Forgot Password?'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={onLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0A0F1A" />
                ) : (
                  <Text style={styles.loginBtnText}>
                    {isDiaspora ? t('enterDashboard') : t('accessWorkHub') || 'Access Work Hub'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/signup')}
                style={{ marginTop: 20 }}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text style={styles.footerText}>
                  {t('newHere') || 'New here?'}{' '}
                  <Text style={styles.link}>{t('createAccount')}</Text>
                </Text>
              </TouchableOpacity>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width, height },
  gradient: { flex: 1, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },

  closeBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  brandName: { fontSize: 32, fontWeight: '800', color: '#fff' },
  tagline: { color: '#94A3B8', fontSize: 15, marginTop: 6, textAlign: 'center' },

  card: {
    borderRadius: 28,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(10, 15, 26, 0.72)',
  },

  roleToggleContainer: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roleCardActive: {
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roleLabel: { fontSize: 15, fontWeight: '800', color: '#94A3B8' },
  roleLabelActive: { color: '#F8FAFC' },
  roleDesc: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  portalHint: {
    color: PREMIUM_GOLD,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 0.3,
  },

  inputContainer: { marginBottom: 14 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    height: 52,
  },
  input: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16, color: '#F8FAFC' },

  loginBtn: {
    height: 54,
    backgroundColor: PREMIUM_GOLD,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: PREMIUM_GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginBtnText: { color: '#0A0F1A', fontSize: 16, fontWeight: '800' },

  footerText: { textAlign: 'center', color: '#94A3B8', fontSize: 14 },
  link: { color: PREMIUM_GOLD, fontWeight: '700' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 18, marginTop: 4 },
  forgotText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});

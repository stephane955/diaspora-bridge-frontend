import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
    Alert, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';
import { mediumFeedback, lightFeedback } from '@/utils/haptics';

const { width, height } = Dimensions.get('window');

const CITIES = [
    "Douala", "Yaoundé", "Bamenda", "Bafoussam",
    "Garoua", "Maroua", "Ngaoundéré", "Kumba"
];

export default function SignupScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useLanguage();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [city, setCity] = useState('');
    const [role, setRole] = useState<'client' | 'provider'>('client');
    const [loading, setLoading] = useState(false);
    const [showCityPicker, setShowCityPicker] = useState(false);

    const handleClose = () => {
        lightFeedback();
        router.replace('/');
    };

    const switchRole = (newRole: 'client' | 'provider') => {
        mediumFeedback();
        setRole(newRole);
    };

    const onSignup = async () => {
        if (!email || !password || !confirmPassword || !fullName) {
            return Alert.alert(t('error'), t('missingFields'));
        }
        if (role === 'provider' && !city) {
            return Alert.alert(t('missingInfo'), t('providersMustSelectCity'));
        }
        if (password !== confirmPassword) {
            return Alert.alert(t('error'), t('passwordsDoNotMatch'));
        }

        mediumFeedback();
        setLoading(true);

        const metadata = {
            full_name: fullName,
            role: role,
            city: role === 'provider' ? city : null,
        };

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: metadata },
        });
        setLoading(false);

        if (error) {
            Alert.alert(t('signupFailed'), error.message);
        } else {
            if (role === 'provider') router.replace('/provider');
            else router.replace('/diaspora');
        }
    };

    const isClient = role === 'client';

    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2831&auto=format&fit=crop' }}
            style={styles.bg}
        >
            <LinearGradient colors={[theme.colors.glassDark, theme.colors.primary]} style={styles.gradient}>
                <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
                        <Ionicons name="close" size={24} color={theme.colors.surface} />
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>{t('createAccount')}</Text>
                            <Text style={styles.subtitle}>{t('joinNetwork')}</Text>
                        </View>

                        <BlurView intensity={30} tint="dark" style={styles.glassCard}>
                            {/* Unmistakable Role Toggle */}
                            <View style={styles.roleToggleContainer}>
                                <TouchableOpacity
                                    style={[styles.roleCard, isClient && styles.roleCardActiveClient]}
                                    onPress={() => switchRole('client')}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="globe-outline" size={22} color={isClient ? theme.colors.active : '#94A3B8'} />
                                    <Text style={[styles.roleLabel, isClient && styles.roleLabelActiveClient]}>{t('roleClient')}</Text>
                                    <Text style={styles.roleHint}>I hire talent</Text>
                                    {isClient && <View style={styles.roleDot} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.roleCard, !isClient && styles.roleCardActiveProvider]}
                                    onPress={() => switchRole('provider')}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="construct-outline" size={22} color={!isClient ? theme.colors.emerald : '#94A3B8'} />
                                    <Text style={[styles.roleLabel, !isClient && styles.roleLabelActiveProvider]}>{t('roleProvider')}</Text>
                                    <Text style={styles.roleHint}>I find work</Text>
                                    {!isClient && <View style={[styles.roleDot, { backgroundColor: theme.colors.emerald }]} />}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('fullNamePlaceholder')}
                                    placeholderTextColor="#94A3B8"
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('emailPlaceholder')}
                                    placeholderTextColor="#94A3B8"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('passwordPlaceholder')}
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('confirmPasswordPlaceholder')}
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />

                                {role === 'provider' && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.input, { justifyContent: 'center' }]}
                                            onPress={() => setShowCityPicker(!showCityPicker)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={{ color: city ? '#fff' : '#94A3B8' }}>{city || t('selectCity')}</Text>
                                            <Ionicons name="chevron-down" size={16} color="#94A3B8" style={{ position: 'absolute', right: 15 }} />
                                        </TouchableOpacity>

                                        {showCityPicker && (
                                            <View style={styles.cityList}>
                                                {CITIES.map((c) => (
                                                    <TouchableOpacity key={c} onPress={() => { lightFeedback(); setCity(c); setShowCityPicker(false); }} style={styles.cityItem} activeOpacity={0.7}>
                                                        <Text style={styles.cityText}>{c}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.signupBtn, !isClient && styles.signupBtnProvider]}
                                onPress={onSignup}
                                disabled={loading}
                                activeOpacity={0.7}
                            >
                                {loading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.signupText}>{t('getStarted')}</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/login')} style={{ marginTop: 20 }} activeOpacity={0.7}>
                                <Text style={styles.footerLink}>
                                    {t('alreadyHaveAccount')} <Text style={{ color: theme.colors.activeSoft, fontWeight: '700' }}>{t('login')}</Text>
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
    bg: { flex: 1, width, height },
    gradient: { flex: 1 },
    safeHeader: { paddingHorizontal: 20, paddingTop: 10 },

    closeBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },

    scrollContent: { padding: 24, paddingBottom: 50, justifyContent: 'center', minHeight: '85%' },

    headerText: { marginBottom: 30 },
    title: { fontSize: 32, ...theme.typography.title, color: '#fff' },
    subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 6, ...theme.typography.subtitle },

    glassCard: {
        borderRadius: theme.radii.xl, padding: 24, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(15, 23, 42, 0.6)'
    },

    roleToggleContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    roleCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: theme.radii.md,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 2,
        borderColor: 'transparent',
        gap: 4,
    },
    roleCardActiveClient: {
        borderColor: theme.colors.active,
        backgroundColor: 'rgba(14,165,233,0.12)',
    },
    roleCardActiveProvider: {
        borderColor: theme.colors.emerald,
        backgroundColor: 'rgba(16,185,129,0.12)',
    },
    roleLabel: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
    roleLabelActiveClient: { color: theme.colors.activeSoft },
    roleLabelActiveProvider: { color: theme.colors.emeraldSoft },
    roleHint: { color: '#64748B', fontSize: 11 },
    roleDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: theme.colors.active, marginTop: 4,
    },

    inputGroup: { gap: 12 },
    input: {
        height: 52, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: theme.radii.sm, paddingHorizontal: 16,
        color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },

    cityList: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: theme.radii.sm, padding: 8, marginTop: -8 },
    cityItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    cityText: { color: '#E2E8F0' },

    signupBtn: {
        backgroundColor: '#fff', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        marginTop: 24, ...theme.shadow.soft,
    },
    signupBtnProvider: {
        backgroundColor: theme.colors.emerald,
    },
    signupText: { color: theme.colors.primary, fontWeight: '800', fontSize: 16 },

    footerLink: { textAlign: 'center', color: '#94A3B8', fontSize: 14 },
});

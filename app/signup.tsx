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

const { width, height } = Dimensions.get('window');

// Available Cities (Cameroon)
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
        router.replace('/');
    };

    const onSignup = async () => {
        // 1. Basic Validation
        if (!email || !password || !confirmPassword || !fullName) {
            return Alert.alert('Error', t('missingFields'));
        }

        // 2. Logic Check: Only Providers MUST have a city
        if (role === 'provider' && !city) {
            return Alert.alert('Missing Info', 'Providers must select a base city.');
        }

        // 3. Password Match
        if (password !== confirmPassword) {
            return Alert.alert('Error', t('passwordsDoNotMatch'));
        }

        setLoading(true);

        // 4. Send correct data based on role
        const metadata = {
            full_name: fullName,
            role: role,
            city: role === 'provider' ? city : null, // Clients get NULL city
        };

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
            },
        });
        setLoading(false);

        if (error) {
            Alert.alert(t('signupFailed'), error.message);
        } else {
            if (role === 'provider') router.replace('/provider');
            else router.replace('/diaspora');
        }
    };

    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2831&auto=format&fit=crop' }}
            style={styles.bg}
        >
            <LinearGradient colors={[theme.colors.glassDark, theme.colors.primary]} style={styles.gradient}>

                <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
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

                            {/* Role Switcher */}
                            <View style={styles.roleContainer}>
                                <TouchableOpacity
                                    style={[styles.roleBtn, role === 'client' && styles.roleActive]}
                                    onPress={() => setRole('client')}
                                >
                                    <Text style={[styles.roleText, role === 'client' && styles.textActive]}>{t('roleClient')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.roleBtn, role === 'provider' && styles.roleActive]}
                                    onPress={() => setRole('provider')}
                                >
                                    <Text style={[styles.roleText, role === 'provider' && styles.textActive]}>{t('roleProvider')}</Text>
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

                                {/* LOGIC CHANGE:
                                    Only show City Dropdown if role === 'provider'
                                */}
                                {role === 'provider' && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.input, { justifyContent: 'center' }]}
                                            onPress={() => setShowCityPicker(!showCityPicker)}
                                        >
                                            <Text style={{ color: city ? '#fff' : '#94A3B8' }}>{city || t('selectCity')}</Text>
                                            <Ionicons name="chevron-down" size={16} color="#94A3B8" style={{ position: 'absolute', right: 15 }} />
                                        </TouchableOpacity>

                                        {showCityPicker && (
                                            <View style={styles.cityList}>
                                                {CITIES.map((c) => (
                                                    <TouchableOpacity key={c} onPress={() => { setCity(c); setShowCityPicker(false); }} style={styles.cityItem}>
                                                        <Text style={styles.cityText}>{c}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>

                            <TouchableOpacity style={styles.signupBtn} onPress={onSignup} disabled={loading}>
                                {loading ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.signupText}>{t('getStarted')}</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/login')} style={{ marginTop: 20 }}>
                                <Text style={styles.footerLink}>
                                    {t('alreadyHaveAccount')} <Text style={{color: '#38BDF8', fontWeight: '700'}}>{t('login')}</Text>
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
    bg: { flex: 1, width: width, height: height },
    gradient: { flex: 1 },
    safeHeader: { paddingHorizontal: 20, paddingTop: 10 },

    closeBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },

    scrollContent: { padding: 24, paddingBottom: 50, justifyContent: 'center', minHeight: '85%' },

    headerText: { marginBottom: 30 },
    title: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 6 },

    glassCard: {
        borderRadius: 24, padding: 24, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(15, 23, 42, 0.6)'
    },

    roleContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 14, marginBottom: 20 },
    roleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    roleActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
    roleText: { color: '#94A3B8', fontWeight: '600' },
    textActive: { color: '#fff', fontWeight: '700' },

    inputGroup: { gap: 12 },
    input: {
        height: 52, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 16,
        color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },

    cityList: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 8, marginTop: -8 },
    cityItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    cityText: { color: '#E2E8F0' },

    signupBtn: {
        backgroundColor: '#fff', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        marginTop: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }
    },
    signupText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },

    footerLink: { textAlign: 'center', color: '#94A3B8', fontSize: 14 },
});
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ImageBackground, StatusBar, Platform, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';

const { width } = Dimensions.get('window');

// Dropdown Options
const LANGUAGES = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
];

export default function LandingScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { language, setLanguage, t, getFlag } = useLanguage();
    const [isLangMenuOpen, setLangMenuOpen] = useState(false);

    // Animations
    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);

    useEffect(() => {
        fadeAnim.value = withDelay(200, withTiming(1, { duration: 1000 }));
        slideAnim.value = withDelay(200, withTiming(0, { duration: 800 }));
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    const handleSelectLanguage = (code: string) => {
        setLanguage(code);
        setLangMenuOpen(false);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2940&auto=format&fit=crop' }}
                style={styles.bg}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={['rgba(15,23,42,0.3)', 'rgba(15,23,42,0.85)', '#0F172A']}
                    style={styles.gradient}
                >
                    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

                        {/* --- HEADER --- */}
                        <View style={styles.header}>
                            {/* Logo */}
                            <BlurView intensity={20} tint="light" style={styles.logoBadge}>
                                <Ionicons name="business" size={20} color={theme.colors.activeSoft} />
                                <Text style={styles.brandText}>{t('brandName')}</Text>
                            </BlurView>

                            {/* Language Dropdown */}
                            <View style={{ zIndex: 50 }}>
                                <TouchableOpacity
                                    style={styles.langBtn}
                                    onPress={() => setLangMenuOpen(!isLangMenuOpen)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.flag}>{getFlag()}</Text>
                                    <Ionicons name="chevron-down" size={12} color="#fff" />
                                </TouchableOpacity>

                                {isLangMenuOpen && (
                                    <View style={styles.dropdownMenu}>
                                        <BlurView intensity={90} tint="dark" style={styles.menuBlur}>
                                            {LANGUAGES.map((lang, index) => (
                                                <TouchableOpacity
                                                    key={lang.code}
                                                    style={[styles.menuItem, index !== LANGUAGES.length - 1 && styles.menuDivider]}
                                                    onPress={() => handleSelectLanguage(lang.code)}
                                                >
                                                    <Text style={{fontSize:16}}>{lang.flag}</Text>
                                                    <Text style={[styles.menuText, language === lang.code && styles.menuTextActive]}>
                                                        {lang.code.toUpperCase()}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </BlurView>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* --- MAIN CONTENT --- */}
                        <Animated.View style={[styles.content, animatedStyle]}>

                            <View style={styles.heroText}>
                                <Text style={styles.headline}>{t('headline')}</Text>
                                <View style={styles.divider} />
                                <Text style={styles.subhead}>{t('subhead')}</Text>
                            </View>

                            {/* Trust Badges */}
                            <View style={styles.badges}>
                                <View style={styles.badge}>
                                    <Ionicons name="shield-checkmark" size={14} color={theme.colors.success} />
                                    <Text style={styles.badgeText}>{t('secure')}</Text>
                                </View>
                                <View style={styles.badge}>
                                    <Ionicons name="globe" size={14} color={theme.colors.activeSoft} />
                                    <Text style={styles.badgeText}>Global</Text>
                                </View>
                            </View>

                            {/* Buttons */}
                            <View style={styles.buttons}>
                                <TouchableOpacity
                                    style={styles.primaryBtn}
                                    onPress={() => router.push('/login')}
                                    activeOpacity={0.9}
                                >
                                    <Text style={styles.primaryText}>{t('enterDashboard')}</Text>
                                    <View style={styles.arrowCircle}>
                                        <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryBtn}
                                    onPress={() => router.push('/signup')}
                                >
                                    <Text style={styles.secondaryText}>{t('createAccount')}</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.footerText}>{t('securedBy')}</Text>

                        </Animated.View>

                    </View>
                </LinearGradient>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.primary },
    bg: { flex: 1, width: '100%', height: '100%' },
    gradient: { flex: 1 },
    safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 30 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, zIndex: 100 },
    logoBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
    brandText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

    langBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    flag: { fontSize: 18 },

    dropdownMenu: { position: 'absolute', top: 45, right: 0, width: 90, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    menuBlur: { paddingVertical: 4 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
    menuDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    menuText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
    menuTextActive: { color: '#fff', fontWeight: '800' },

    content: { gap: 24, zIndex: 1 },
    heroText: { gap: 12 },
    headline: { fontSize: 38, fontWeight: '800', color: '#fff', lineHeight: 44, letterSpacing: -0.5 },
    divider: { width: 40, height: 4, backgroundColor: '#0EA5E9', borderRadius: 2 },
    subhead: { fontSize: 17, color: '#CBD5E1', lineHeight: 26, maxWidth: '95%' },

    badges: { flexDirection: 'row', gap: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    badgeText: { color: '#E2E8F0', fontWeight: '600', fontSize: 12 },

    buttons: { gap: 14, marginTop: 10 },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 10, paddingLeft: 20, borderRadius: 40 },
    primaryText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
    arrowCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    secondaryBtn: { alignItems: 'center', paddingVertical: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
    secondaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    footerText: { textAlign: 'center', color: '#64748B', fontSize: 12, fontWeight: '500', marginTop: 10 }
});

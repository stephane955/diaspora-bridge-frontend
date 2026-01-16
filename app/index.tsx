import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';

export default function LandingScreen() {
    const router = useRouter();
    const { language, setLanguage, t } = useLanguage();

    const headlineOpacity = useSharedValue(0);
    const headlineTranslate = useSharedValue(18);
    const buttonsOpacity = useSharedValue(0);
    const buttonsTranslate = useSharedValue(18);
    const footerOpacity = useSharedValue(0);
    const footerTranslate = useSharedValue(18);

    useEffect(() => {
        headlineOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
        headlineTranslate.value = withDelay(100, withTiming(0, { duration: 500 }));
        buttonsOpacity.value = withDelay(250, withTiming(1, { duration: 500 }));
        buttonsTranslate.value = withDelay(250, withTiming(0, { duration: 500 }));
        footerOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
        footerTranslate.value = withDelay(400, withTiming(0, { duration: 500 }));
    }, [buttonsOpacity, buttonsTranslate, footerOpacity, footerTranslate, headlineOpacity, headlineTranslate]);

    const headlineStyle = useAnimatedStyle(() => ({
        opacity: headlineOpacity.value,
        transform: [{ translateY: headlineTranslate.value }],
    }));

    const buttonsStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
        transform: [{ translateY: buttonsTranslate.value }],
    }));

    const footerStyle = useAnimatedStyle(() => ({
        opacity: footerOpacity.value,
        transform: [{ translateY: footerTranslate.value }],
    }));

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'fr' : 'en');
    };

    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=2000&auto=format&fit=crop' }}
            style={styles.bg}
        >
            <LinearGradient
                colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.9)']}
                style={styles.overlay}
            >
                <StatusBar barStyle="light-content" />

                <View style={styles.header}>
                    <View>
                        <Text style={styles.brand}>{t('brandName')}</Text>
                        <Text style={styles.strap}>{t('heroCta')}</Text>
                    </View>
                    <TouchableOpacity style={styles.langToggle} onPress={toggleLanguage}>
                        <Ionicons name="language" size={16} color="#0EA5E9" />
                        <Text style={styles.langText}>{language === 'en' ? 'FR' : 'EN'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Animated.View style={headlineStyle}>
                        <Text style={styles.headline}>{t('headline')}</Text>
                        <Text style={styles.subhead}>{t('subhead')}</Text>

                        <View style={styles.badges}>
                            <View style={styles.badge}>
                                <Ionicons name="shield-checkmark" size={16} color="#4ADE80" />
                                <Text style={styles.badgeText}>{t('secure')}</Text>
                            </View>
                            <View style={styles.badge}>
                                <Ionicons name="pulse" size={16} color="#38BDF8" />
                                <Text style={styles.badgeText}>{t('tracking')}</Text>
                            </View>
                            <View style={styles.badge}>
                                <Ionicons name="chatbubbles" size={16} color="#FBBF24" />
                                <Text style={styles.badgeText}>{t('support')}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View style={buttonsStyle}>
                        <BlurView intensity={60} tint="light" style={styles.glassCard}>
                            <View style={styles.buttons}>
                                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/login')}>
                                    <Text style={styles.primaryText}>{t('login')}</Text>
                                    <Ionicons name="arrow-forward" size={18} color="#0EA5E9" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/signup')}>
                                    <Text style={styles.secondaryText}>{t('signup')}</Text>
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    </Animated.View>

                    <Animated.View style={footerStyle}>
                        <View style={styles.footer}>
                            <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                            <Text style={styles.footerText}>{t('securedBy')}</Text>
                        </View>
                    </Animated.View>
                </View>
            </LinearGradient>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    overlay: { flex: 1, padding: 24, justifyContent: 'space-between' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brand: { color: '#E2E8F0', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
    strap: { color: '#CBD5E1', marginTop: 4, fontSize: 12, fontWeight: '600' },
    langToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    langText: { color: '#E2E8F0', fontWeight: '700', fontSize: 12 },
    content: { gap: 18, marginBottom: 40 },
    headline: { color: '#fff', fontSize: 34, fontWeight: '800', lineHeight: 38 },
    subhead: { color: '#E2E8F0', fontSize: 16, lineHeight: 22 },
    badges: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
    badgeText: { color: '#E2E8F0', fontWeight: '700', fontSize: 12 },
    glassCard: { borderRadius: 24, padding: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
    buttons: { gap: 12 },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E2E8F0', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 16 },
    primaryText: { color: '#0F172A', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
    secondaryBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)' },
    secondaryText: { color: '#E2E8F0', fontWeight: '700', fontSize: 15, textAlign: 'center' },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    footerText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' }
});

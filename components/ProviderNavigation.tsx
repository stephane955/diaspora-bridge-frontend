import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter, usePathname } from 'expo-router';
import { mediumFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext'; // <--- 1. Import Context

type IconName = keyof typeof Ionicons.glyphMap;

export default function ProviderNavigation() {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage(); // <--- 2. Get Translation Hook

    // FINAL 5-TAB CONFIGURATION (Dynamic Labels)
    const tabs: { id: string; icon: IconName; label: string; route: Href }[] = [
        {
            id: 'hub',
            icon: 'grid',
            label: t('tabHome') || 'Hub', // Uses 'Home' / 'Accueil'
            route: '/provider'
        },
        {
            id: 'market',
            icon: 'search',
            label: t('marketTitle') || 'Market', // Uses 'Find Work' / 'Trouver un Job'
            route: '/provider/market'
        },
        {
            id: 'sites',
            icon: 'hammer',
            label: t('sitesTitle') || 'My Sites', // Uses 'My Sites' / 'Mes Chantiers'
            route: '/provider/active'
        },
        {
            id: 'wallet',
            icon: 'wallet',
            // Fallback to "Wallet" if translation is missing
            label: t('clientDashboard.myWallet') || 'Wallet',
            route: '/provider/earnings'
        },
        {
            id: 'profile',
            icon: 'person',
            label: t('tabProfile') || 'Profile', // Uses 'Profile' / 'Profil'
            route: '/provider/profile'
        },
    ];

    const handlePress = (route: Href) => {
        mediumFeedback();
        if (pathname !== route) {
            router.push(route);
        }
    };

    return (
        <View style={styles.container}>
            <BlurView intensity={100} tint="light" style={styles.glass}>
                {tabs.map((tab) => {
                    // Check if active (handles root path '/' vs '/provider')
                    const isActive = pathname === tab.route || (tab.route === '/provider' && pathname === '/provider/');

                    const iconName = isActive ? tab.icon : (tab.icon + '-outline') as IconName;

                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => handlePress(tab.route)}
                            style={styles.tab}
                        >
                            <Ionicons
                                name={iconName}
                                size={24}
                                color={isActive ? '#0F172A' : '#94A3B8'}
                            />
                            <Text style={[
                                styles.labelText,
                                { color: isActive ? '#0F172A' : '#94A3B8' }
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    glass: {
        flexDirection: 'row', width: '100%', height: 85,
        justifyContent: 'space-around', alignItems: 'center', paddingBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#E2E8F0',
    },
    tab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, flex: 1 },
    labelText: { fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' }
});
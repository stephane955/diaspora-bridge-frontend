import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter, usePathname } from 'expo-router';
import { mediumFeedback } from '@/utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

export default function ProviderNavigation() {
    const router = useRouter();
    const pathname = usePathname();

    const tabs: { id: string; icon: IconName; label: string; route: Href }[] = [
        { id: 'hub', icon: 'grid', label: 'Hub', route: '/provider' },
        { id: 'market', icon: 'search', label: 'Find Work', route: '/provider/market' }, // <--- ADD THIS
        { id: 'jobs', icon: 'hammer', label: 'Sites', route: '/provider/active' },
        { id: 'wallet', icon: 'wallet', label: 'Wallet', route: '/provider/earnings' },
        { id: 'chat', icon: 'chatbubbles', label: 'Requests', route: '/provider/requests' },
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
                    const isActive = pathname === tab.route;
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
                                color={isActive ? '#0EA5E9' : '#64748B'}
                            />
                            <Text style={[styles.labelText, { color: isActive ? '#0EA5E9' : '#64748B' }]}>
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
    container: {
        position: 'absolute',
        bottom: 0, // Docked to bottom
        left: 0,
        right: 0,
    },
    glass: {
        flexDirection: 'row',
        width: '100%',
        height: 85, // Taller for bottom docking
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 20, // Space for home indicator
        backgroundColor: 'rgba(255,255,255,0.85)', // Bright white glass
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10
    },
    tab: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        flex: 1,
    },
    labelText: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    }
});
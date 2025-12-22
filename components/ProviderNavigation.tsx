import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { mediumFeedback } from '@/utils/haptics';

export default function ProviderNavigation() {
    const router = useRouter();
    const pathname = usePathname();

    // Routes updated to match your verified file structure
    const tabs = [
        { id: 'hub', icon: 'grid', label: 'Hub', route: '/provider' },
        { id: 'jobs', icon: 'hammer', label: 'Sites', route: '/provider/active' },
        { id: 'wallet', icon: 'cash', label: 'Cash', route: '/provider/earnings' },
        { id: 'chat', icon: 'chatbubbles', label: 'Chat', route: '/provider/requests' },
    ];

    return (
        <View style={styles.container}>
            <BlurView intensity={100} tint="dark" style={styles.glass}>
                {tabs.map((tab) => {
                    const isActive = pathname === tab.route;
                    // Ternary icon naming to avoid stray string concatenation errors
                    const iconName = isActive ? tab.icon : `${tab.icon}-outline`;

                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => {
                                mediumFeedback();
                                router.push(tab.route as any);
                            }}
                            style={[styles.tab, isActive && styles.activeTab]}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={iconName as any}
                                size={22}
                                color={isActive ? '#fff' : '#94A3B8'}
                            />
                            {isActive ? (
                                <Text style={styles.labelText}>{tab.label}</Text>
                            ) : null}
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
        bottom: 30,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 1000 // Ensure it stays above marketplace cards
    },
    glass: {
        flexDirection: 'row',
        height: 65,
        width: '100%',
        borderRadius: 32,
        paddingHorizontal: 8,
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        // Shadow for premium feel
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 24
    },
    activeTab: {
        backgroundColor: '#0EA5E9'
    },
    labelText: {
        color: '#fff',
        fontWeight: '800',
        marginLeft: 8,
        fontSize: 12
    }
});
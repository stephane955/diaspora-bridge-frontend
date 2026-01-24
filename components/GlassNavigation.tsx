import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter, usePathname } from 'expo-router';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { theme } from '@/constants/theme';

export default function GlassNavigation() {
    const router = useRouter();
    const pathname = usePathname();

    const handlePress = (route: Href) => {
        mediumFeedback();
        if (pathname !== route) {
            router.push(route);
        }
    };

    const handleMainAction = () => {
        successFeedback();
        router.push('/diaspora/new');
    };

    return (
        <View style={styles.container}>
            {/* tint="light" ensures it looks white/bright, not gray */}
            <BlurView intensity={100} tint="light" style={styles.glass}>

                {/* Home */}
                <TouchableOpacity onPress={() => handlePress('/diaspora')} style={styles.tab}>
                    <Ionicons
                        name={pathname === '/diaspora' ? "home" : "home-outline"}
                        size={26}
                        color={pathname === '/diaspora' ? "#0EA5E9" : "#64748B"}
                    />
                </TouchableOpacity>

                {/* Post Job (Center Button) */}
                <View style={styles.actionWrapper}>
                    <TouchableOpacity onPress={handleMainAction} style={styles.actionBtn}>
                        <Ionicons name="add" size={30} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Profile */}
                <TouchableOpacity onPress={() => handlePress('/diaspora/profile')} style={styles.tab}>
                    <Ionicons
                        name={pathname.includes('profile') ? "person" : "person-outline"}
                        size={26}
                        color={pathname.includes('profile') ? "#0EA5E9" : "#64748B"}
                    />
                </TouchableOpacity>

            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0, // SIT ON BOTTOM
        left: 0,
        right: 0,
    },
    glass: {
        width: '100%',
        height: 85, // Taller to handle safe area
        flexDirection: 'row',
        justifyContent: 'space-around', // Spread items evenly
        alignItems: 'center',
        paddingBottom: 20, // Push content up so it's not hidden by home indicator
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.85)', // Whiter background
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    tab: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionWrapper: {
        width: 60,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20, // Float the button slightly above the bar
    },
    actionBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
});
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
            <BlurView intensity={80} tint="light" style={styles.glass}>

                <TouchableOpacity onPress={() => handlePress('/diaspora')} style={styles.tab}>
                    <Ionicons
                        name={pathname === '/diaspora' ? "home" : "home-outline"}
                        size={24}
                        color={pathname === '/diaspora' ? "#0EA5E9" : "#64748B"}
                    />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handlePress('/wallet')} style={styles.tab}>
                    <Ionicons
                        name={pathname.includes('wallet') ? "wallet" : "wallet-outline"}
                        size={24}
                        color={pathname.includes('wallet') ? theme.colors.active : theme.colors.textMuted}
                    />
                </TouchableOpacity>

                <View style={styles.actionWrapper}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleMainAction}>
                        <Ionicons name="add" size={32} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* FIXED: Points to Inbox */}
                <TouchableOpacity onPress={() => handlePress('/diaspora/inbox')} style={styles.tab}>
                    <Ionicons
                        name={pathname.includes('inbox') ? "chatbubble" : "chatbubble-outline"}
                        size={24}
                        color={pathname.includes('inbox') ? theme.colors.active : theme.colors.textMuted}
                    />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handlePress('/diaspora/profile')} style={styles.tab}>
                    <Ionicons
                        name={pathname.includes('profile') ? "person" : "person-outline"}
                        size={24}
                        color={pathname.includes('profile') ? theme.colors.active : theme.colors.textMuted}
                    />
                </TouchableOpacity>

            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
    glass: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: 70,
        borderRadius: 35,
        paddingHorizontal: 10,
        overflow: 'visible',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)'
    },
    tab: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center' },
    actionWrapper: { width: 60, height: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    actionBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', top: -25, elevation: 10 }
});

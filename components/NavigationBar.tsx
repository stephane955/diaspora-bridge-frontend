import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme as defaultTheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { mediumFeedback, lightFeedback } from '@/utils/haptics';

type Props = {
    title: string;
    subtitle?: string;
    onMenuPress?: () => void;
    onRefresh?: () => void;
    showBack?: boolean;
    /** Role accent for glow line — Electric Blue for Diaspora, Emerald for Provider */
    dynamicColor?: string;
    showNotifDot?: boolean;
    /** @deprecated Header is now Inbox-standard everywhere */
    heroMode?: boolean;
    /** @deprecated Unused with standardized header */
    scrollY?: unknown;
    /** @deprecated Unused with standardized header */
    tint?: 'light' | 'dark';
};

/**
 * Global header: 100% identical to Inbox.
 * LinearGradient(primary, primarySoft), useSafeAreaInsets for top/bottom fit, 20px horizontal/bottom, 24px bottom radius, shadow.
 * Back 40x40 rgba(255,255,255,0.2), title 18/800 #fff. Optional refresh + menu on right.
 */
export default function NavigationBar({
    title,
    subtitle,
    onMenuPress,
    onRefresh,
    showBack = true,
    dynamicColor = defaultTheme.colors.active,
    showNotifDot = false,
    heroMode: _heroMode,
    scrollY: _scrollY,
    tint: _tint,
}: Props) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();

    const goBack = () => {
        mediumFeedback();
        if (router.canGoBack()) router.back();
        else router.replace('/');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[defaultTheme.colors.primary, defaultTheme.colors.primarySoft]}
                style={[styles.inboxHeader, { paddingTop: insets.top, paddingBottom: 20 }]}
            >
                {showBack ? (
                    <Pressable onPress={goBack} hitSlop={8}>
                        <View style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={defaultTheme.colors.surface} />
                        </View>
                    </Pressable>
                ) : (
                    <View style={styles.backBtnPlaceholder} />
                )}
                <View style={styles.center}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.actions}>
                    {onRefresh && (
                        <Pressable onPress={() => { lightFeedback(); onRefresh(); }} hitSlop={8}>
                            <View style={styles.headerIconBtn}>
                                <Ionicons name="notifications-outline" size={22} color={defaultTheme.colors.surface} />
                                {showNotifDot && (
                                    <View style={[styles.notifDot, { backgroundColor: theme.colors.danger }]} />
                                )}
                            </View>
                        </Pressable>
                    )}
                    <Pressable
                        onPress={() => {
                            mediumFeedback();
                            (onMenuPress ?? (() => router.replace('/diaspora')))();
                        }}
                        hitSlop={8}
                    >
                        <View style={styles.headerIconBtn}>
                            <Ionicons name="grid-outline" size={22} color={defaultTheme.colors.surface} />
                        </View>
                    </Pressable>
                </View>
            </LinearGradient>
            <View style={[styles.glowLine, { backgroundColor: dynamicColor }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        zIndex: 100,
        overflow: 'hidden',
    },
    inboxHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backBtnPlaceholder: { width: 40, height: 40 },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: defaultTheme.colors.surface,
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notifDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: defaultTheme.colors.surface,
    },
    glowLine: {
        height: 2,
        borderRadius: 1,
        opacity: 0.15,
    },
});

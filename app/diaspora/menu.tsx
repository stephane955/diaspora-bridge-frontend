import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { lightFeedback, mediumFeedback } from '@/utils/haptics';
import { theme } from '@/constants/theme';

const MENU_ITEMS: Array<{
    key: string;
    href: '/diaspora/wallet' | '/diaspora/profile' | '/diaspora/settings';
    labelKey: 'menuWallet' | 'menuProfile' | 'menuSettings';
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    { key: 'wallet', href: '/diaspora/wallet', labelKey: 'menuWallet', icon: 'wallet-outline' },
    { key: 'profile', href: '/diaspora/profile', labelKey: 'menuProfile', icon: 'person-outline' },
    { key: 'settings', href: '/diaspora/settings', labelKey: 'menuSettings', icon: 'settings-outline' },
];

export default function MenuScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { logout } = useAuth();
    const { t } = useLanguage();

    const handleLogout = () => {
        mediumFeedback();
        Alert.alert(
            t('menuLogout'),
            t('signOutConfirmBody') ?? 'Are you sure you want to log out?',
            [
                { text: t('cancel') ?? 'Cancel', style: 'cancel' },
                {
                    text: t('menuLogout'),
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        router.replace('/login');
                    },
                },
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('menuTitle')}</Text>
                    <Text style={styles.headerSub}>Account & preferences</Text>
                </View>

                <View style={styles.cardGroup}>
                    {MENU_ITEMS.map((item) => (
                        <TouchableOpacity
                            key={item.key}
                            activeOpacity={0.8}
                            onPress={() => {
                                lightFeedback();
                                router.push(item.href);
                            }}
                            style={styles.cardTouch}
                        >
                            <View style={[styles.card, styles.cardSurface]}>
                                <View style={styles.cardLeft}>
                                    <View style={styles.iconWrap}>
                                        <Ionicons name={item.icon} size={22} color={theme.colors.active} />
                                    </View>
                                    <Text style={styles.cardLabel}>{t(item.labelKey)}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.spacer} />

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleLogout}
                    style={styles.logoutTouch}
                >
                    <View style={styles.logoutBtn}>
                        <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
                        <Text style={styles.logoutText}>{t('menuLogout')}</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: Platform.OS === 'android' ? 56 : 44,
        paddingBottom: 120,
    },
    header: {
        marginBottom: theme.spacing.xl,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: theme.colors.text,
        letterSpacing: -0.5,
    },
    headerSub: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginTop: 4,
        fontWeight: '500',
    },
    cardGroup: {
        gap: theme.spacing.sm,
    },
    cardTouch: {
        borderRadius: theme.radii.md,
        overflow: 'hidden',
        ...theme.shadow.soft,
    },
    cardSurface: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.md,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: theme.radii.sm,
        backgroundColor: `${theme.colors.active}18`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
    },
    cardLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    spacer: {
        height: theme.spacing.xl,
    },
    logoutTouch: {
        borderRadius: theme.radii.md,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: theme.colors.danger,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
            },
            android: { elevation: 3 },
        }),
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.md,
        gap: theme.spacing.sm,
        borderWidth: 1.5,
        borderColor: theme.colors.danger,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.danger,
    },
});

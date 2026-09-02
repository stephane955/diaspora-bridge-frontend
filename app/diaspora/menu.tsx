import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { lightFeedback, mediumFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    DANGER,
    icon as iconSize,
    radius,
    shadow,
    space,
    text,
    withAlpha,
} from '@/constants/design';

const NAV_ITEMS: Array<{
    key: string;
    href: '/diaspora/projects' | '/diaspora/new' | '/diaspora/timeline';
    labelKey: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    { key: 'projects', href: '/diaspora/projects', labelKey: 'tabProjects', icon: 'folder-open-outline' },
    { key: 'new', href: '/diaspora/new', labelKey: 'tabPostJob', icon: 'add-circle-outline' },
    { key: 'timeline', href: '/diaspora/timeline', labelKey: 'Timeline', icon: 'time-outline' },
];

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
    const router = useRouter();
    const { logout } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();

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

    const renderRow = (item: { key: string; href: any; labelKey: string; icon: keyof typeof Ionicons.glyphMap }) => (
        <TouchableOpacity
            key={item.key}
            activeOpacity={0.8}
            onPress={() => {
                lightFeedback();
                router.push(item.href);
            }}
            style={styles.cardTouch}
        >
            <View
                style={[
                    styles.card,
                    { backgroundColor: c.surface, borderColor: c.border },
                ]}
            >
                <View style={styles.cardLeft}>
                    <View style={[styles.iconWrap, { backgroundColor: withAlpha(c.gold, ALPHA.medium) }]}>
                        <Ionicons name={item.icon} size={iconSize.md} color={c.gold} />
                    </View>
                    <Text style={[styles.cardLabel, { color: c.textPrimary }]}>
                        {t(item.labelKey) ?? item.labelKey}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={iconSize.sm} color={c.muted} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <PremiumHeader
                title={t('menuTitle') ?? 'Menu'}
                showBack
                fallbackRoute="/diaspora"
                menuItems={clientMenuItems(router, t)}
            />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={offsets.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.muted }]}>
                        {t('menuNavigate') ?? 'Navigate'}
                    </Text>
                    <View style={styles.cardGroup}>{NAV_ITEMS.map(renderRow)}</View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.muted }]}>
                        {t('menuAccount') ?? 'Account'}
                    </Text>
                    <View style={styles.cardGroup}>{MENU_ITEMS.map(renderRow)}</View>
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleLogout}
                    style={styles.cardTouch}
                >
                    <View style={[styles.logoutBtn, { backgroundColor: c.surface }]}>
                        <Ionicons name="log-out-outline" size={iconSize.md} color={DANGER} />
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
    },
    scroll: {
        flex: 1,
    },
    section: {
        marginBottom: space.xl,
    },
    sectionTitle: {
        ...text.label,
        marginBottom: space.sm,
    },
    cardGroup: {
        gap: space.sm,
    },
    cardTouch: {
        borderRadius: radius.lg,
        ...shadow.card,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: space.md,
    },
    cardLabel: text.body,
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.lg,
        gap: space.sm,
        borderWidth: 1.5,
        borderColor: DANGER,
    },
    logoutText: {
        ...text.body,
        fontWeight: '800',
        color: DANGER,
    },
});

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { lightFeedback } from '@/utils/haptics';
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function ClientSettingsScreen() {
    const insets = useSafeAreaInsets();
    const { t, setLanguage, language } = useLanguage();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const cycleLanguage = () => {
        lightFeedback();
        const currentIndex = LANGUAGES.findIndex((l) => l.code === language);
        const nextIndex = (currentIndex + 1) % LANGUAGES.length;
        setLanguage(LANGUAGES[nextIndex].code);
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <NavigationBar title={t('menuSettings') ?? 'Settings'} showBack dynamicColor={theme.colors.active} />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 120, paddingHorizontal: theme.spacing.lg }]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>{t('preferences') ?? 'Preferences'}</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.row} onPress={cycleLanguage} activeOpacity={0.8}>
                        <View style={styles.rowIconBg}>
                            <Ionicons name="globe-outline" size={20} color={theme.colors.active} />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{t('languageName') ?? 'Language'}</Text>
                            <Text style={styles.rowSub}>
                                {LANGUAGES.find((l) => l.code === language)?.label ?? 'English'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={[styles.rowIconBg, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
                            <Ionicons name="notifications-outline" size={20} color={theme.colors.warning} />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{t('notifications') ?? 'Notifications'}</Text>
                            <Text style={styles.rowSub}>{t('pushNotifs') ?? 'Push notifications'}</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={(v) => { lightFeedback(); setNotificationsEnabled(v); }}
                            trackColor={{ false: theme.colors.border, true: theme.colors.active }}
                            thumbColor={theme.colors.surface}
                        />
                    </View>
                </View>

                <Text style={styles.sectionTitle}>{t('general') ?? 'General'}</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => lightFeedback()}>
                        <View style={[styles.rowIconBg, { backgroundColor: theme.colors.background }]}>
                            <Ionicons name="help-buoy-outline" size={20} color={theme.colors.textMuted} />
                        </View>
                        <Text style={[styles.rowTitle, { flex: 1 }]}>{t('support') ?? 'Support'}</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => lightFeedback()}>
                        <View style={[styles.rowIconBg, { backgroundColor: theme.colors.background }]}>
                            <Ionicons name="document-text-outline" size={20} color={theme.colors.textMuted} />
                        </View>
                        <Text style={[styles.rowTitle, { flex: 1 }]}>{t('legal') ?? 'Legal'}</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: 100 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.textSubtle,
        marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.xs,
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        ...theme.shadow.soft,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.md,
    },
    rowIconBg: {
        width: 40,
        height: 40,
        borderRadius: theme.radii.sm,
        backgroundColor: `${theme.colors.active}18`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
    rowSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: theme.colors.border, marginLeft: 70 },
});

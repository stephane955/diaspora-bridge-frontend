import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Switch,
    ScrollView, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function ProviderSettingsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { t, setLanguage, language } = useLanguage();

    const [isOnline, setIsOnline] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    // Initial Fetch
    useEffect(() => {
        if (user) {
            supabase.from('profiles').select('is_online').eq('id', user.id).single()
                .then(({ data }) => {
                    if (data) setIsOnline(data.is_online);
                });
        }
    }, [user]);

    // --- ACTIONS ---
    const toggleOnline = async (value: boolean) => {
        setIsOnline(value); // Optimistic UI
        try {
            await supabase.from('profiles').update({ is_online: value }).eq('id', user?.id);
        } catch (e) {
            setIsOnline(!value); // Revert on error
            Alert.alert("Error", "Connection failed.");
        }
    };

    const handleSignOut = async () => {
        Alert.alert(t('signOut'), t('signOutConfirmBody'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('signOut'), style: 'destructive', onPress: async () => {
                    await signOut();
                    router.replace('/login');
                }}
        ]);
    };

    const handleDelete = () => {
        Alert.alert(t('deleteAccountTitle'), t('deleteAccountConfirm'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('delete'), style: 'destructive', onPress: () => Alert.alert("Contact Support", "Please contact support to delete provider accounts with active history.") }
        ]);
    };

    // Cycle Language for simplicity in settings
    const cycleLanguage = () => {
        const currentIndex = LANGUAGES.findIndex(l => l.code === language);
        const nextIndex = (currentIndex + 1) % LANGUAGES.length;
        setLanguage(LANGUAGES[nextIndex].code);
    };

    return (
        <View style={styles.container}>
            <NavigationBar title={t('settingsTitle') ?? 'Settings'} showBack onMenuPress={() => router.replace('/provider')} dynamicColor={theme.colors.emerald} />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120, paddingHorizontal: theme.spacing.lg }]}>

                {/* --- SECTION 1: AVAILABILITY --- */}
                <Text style={styles.sectionTitle}>{t('availability')}</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowIconBg}><Ionicons name="power" size={20} color={theme.colors.success} /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.rowTitle}>{t('onlineStatus')}</Text>
                            <Text style={styles.rowSub}>{t('onlineDesc')}</Text>
                        </View>
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnline}
                            trackColor={{ false: theme.colors.border, true: theme.colors.success }}
                            thumbColor={theme.colors.surface}
                        />
                    </View>
                </View>

                {/* --- SECTION 2: PREFERENCES --- */}
                <Text style={styles.sectionTitle}>{t('preferences')}</Text>
                <View style={styles.card}>
                    {/* Language */}
                    <TouchableOpacity style={styles.row} onPress={cycleLanguage}>
                        <View style={[styles.rowIconBg, { backgroundColor: theme.colors.activeSoft + '25' }]}><Ionicons name="globe-outline" size={20} color={theme.colors.active} /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.rowTitle}>{t('languageName')}</Text>
                            <Text style={styles.rowSub}>{LANGUAGES.find(l => l.code === language)?.label}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* Notifications */}
                    <View style={styles.row}>
                        <View style={[styles.rowIconBg, { backgroundColor: theme.colors.warning + '20' }]}><Ionicons name="notifications-outline" size={20} color={theme.colors.warning} /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.rowTitle}>{t('notifications')}</Text>
                            <Text style={styles.rowSub}>{t('pushNotifs')}</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: theme.colors.border, true: theme.colors.warning }}
                            thumbColor={theme.colors.surface}
                        />
                    </View>
                </View>

                {/* --- SECTION 3: GENERAL --- */}
                <Text style={styles.sectionTitle}>{t('general')}</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.row}>
                        <View style={[styles.rowIconBg, { backgroundColor: theme.colors.background }]}><Ionicons name="help-buoy-outline" size={20} color={theme.colors.textMuted} /></View>
                        <Text style={[styles.rowTitle, {flex:1}]}>{t('support')}</Text>
                        <Ionicons name="open-outline" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.row}>
                        <View style={[styles.rowIconBg, { backgroundColor: theme.colors.background }]}><Ionicons name="document-text-outline" size={20} color={theme.colors.textMuted} /></View>
                        <Text style={[styles.rowTitle, {flex:1}]}>{t('legal')}</Text>
                        <Ionicons name="open-outline" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>
                </View>

                {/* --- FOOTER ACTIONS --- */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
                    <Text style={styles.logoutText}>{t('signOut')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteText}>{t('deleteAccountTitle')}</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>{t('version')}</Text>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { paddingTop: theme.spacing.md },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textSubtle, marginBottom: theme.spacing.sm, marginTop: theme.spacing.sm, textTransform: 'uppercase' },

    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft },
    row: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: theme.spacing.sm },
    rowIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.success + '20', alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
    rowSub: { fontSize: 13, color: theme.colors.textSubtle, marginTop: 2 },
    divider: { height: 1, backgroundColor: theme.colors.border, marginLeft: 64 },

    logoutBtn: { marginTop: theme.spacing.xl, backgroundColor: theme.colors.danger + '18', padding: theme.spacing.md, borderRadius: theme.radii.sm, alignItems: 'center' },
    logoutText: { color: theme.colors.danger, fontWeight: '700', fontSize: 16 },

    deleteBtn: { marginTop: theme.spacing.sm, alignItems: 'center', padding: theme.spacing.sm },
    deleteText: { color: theme.colors.textSubtle, fontSize: 14, textDecorationLine: 'underline' },

    versionText: { textAlign: 'center', color: theme.colors.textSubtle, fontSize: 12, marginTop: theme.spacing.lg },
});
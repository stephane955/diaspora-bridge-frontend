import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Switch,
    ScrollView, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function ProviderSettingsScreen() {
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
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('settingsTitle')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>

                {/* --- SECTION 1: AVAILABILITY --- */}
                <Text style={styles.sectionTitle}>{t('availability')}</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowIconBg}><Ionicons name="power" size={20} color="#22C55E" /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.rowTitle}>{t('onlineStatus')}</Text>
                            <Text style={styles.rowSub}>{t('onlineDesc')}</Text>
                        </View>
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnline}
                            trackColor={{ false: '#E2E8F0', true: '#22C55E' }}
                            thumbColor={'#fff'}
                        />
                    </View>
                </View>

                {/* --- SECTION 2: PREFERENCES --- */}
                <Text style={styles.sectionTitle}>{t('preferences')}</Text>
                <View style={styles.card}>
                    {/* Language */}
                    <TouchableOpacity style={styles.row} onPress={cycleLanguage}>
                        <View style={[styles.rowIconBg, {backgroundColor: '#EFF6FF'}]}><Ionicons name="globe-outline" size={20} color="#3B82F6" /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.rowTitle}>{t('languageName')}</Text>
                            <Text style={styles.rowSub}>{LANGUAGES.find(l => l.code === language)?.label}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* Notifications */}
                    <View style={styles.row}>
                        <View style={[styles.rowIconBg, {backgroundColor: '#FFF7ED'}]}><Ionicons name="notifications-outline" size={20} color="#F97316" /></View>
                        <View style={{flex: 1}}>
                            <Text style={styles.rowTitle}>{t('notifications')}</Text>
                            <Text style={styles.rowSub}>{t('pushNotifs')}</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: '#E2E8F0', true: '#F97316' }}
                            thumbColor={'#fff'}
                        />
                    </View>
                </View>

                {/* --- SECTION 3: GENERAL --- */}
                <Text style={styles.sectionTitle}>{t('general')}</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.row}>
                        <View style={[styles.rowIconBg, {backgroundColor: '#F1F5F9'}]}><Ionicons name="help-buoy-outline" size={20} color="#64748B" /></View>
                        <Text style={[styles.rowTitle, {flex:1}]}>{t('support')}</Text>
                        <Ionicons name="open-outline" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.row}>
                        <View style={[styles.rowIconBg, {backgroundColor: '#F1F5F9'}]}><Ionicons name="document-text-outline" size={20} color="#64748B" /></View>
                        <Text style={[styles.rowTitle, {flex:1}]}>{t('legal')}</Text>
                        <Ionicons name="open-outline" size={20} color="#CBD5E1" />
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

    scroll: { padding: 24, paddingBottom: 60 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 12, marginTop: 12, textTransform: 'uppercase' },

    card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    rowIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    rowSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 64 },

    logoutBtn: { marginTop: 32, backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, alignItems: 'center' },
    logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 16 },

    deleteBtn: { marginTop: 12, alignItems: 'center', padding: 10 },
    deleteText: { color: '#94A3B8', fontSize: 14, textDecorationLine: 'underline' },

    versionText: { textAlign: 'center', color: '#CBD5E1', fontSize: 12, marginTop: 20 },
});
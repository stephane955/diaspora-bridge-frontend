import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    RefreshControl, StatusBar, Platform, ImageBackground, Modal, Alert
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ProviderDashboard() {
    const router = useRouter();
    const navigation = useNavigation();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();

    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ activeJobs: 0, pendingRequests: 0, balance: 0 });
    const [isOnline, setIsOnline] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // --- FETCH DATA ---
    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            // 1. Profile & Status
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileData) {
                setProfile(profileData);
                setIsOnline(profileData.is_online !== false);
            }

            // 2. Active Jobs
            const { count: jobsCount } = await supabase.from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_provider_id', user.id) // Corrected column name based on your schema
                .in('status', ['in_progress', 'In Progress']);

            // 3. Requests
            const { count: requestsCount } = await supabase.from('applications') // or project_applications
                .select('*', { count: 'exact', head: true })
                .eq('provider_id', user.id)
                .eq('status', 'pending');

            // 4. Wallet
            const { data: tx } = await supabase.from('transactions').select('amount').eq('user_id', user.id);
            const balance = tx?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            setStats({
                activeJobs: jobsCount || 0,
                pendingRequests: requestsCount || 0,
                balance: balance
            });

        } catch (e) {
            console.error(e);
        }
    }, [user]);

    // Refresh on Focus
    useEffect(() => {
        fetchData();
        const unsub = navigation.addListener('focus', fetchData);
        return unsub;
    }, [navigation, fetchData]);

    // --- ACTIONS ---
    const toggleOnlineStatus = async () => {
        const newStatus = !isOnline;
        setIsOnline(newStatus); // Optimistic Update
        try {
            await supabase.from('profiles').update({ is_online: newStatus }).eq('id', user?.id);
        } catch (e) {
            setIsOnline(!newStatus); // Revert on error
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleSignOut = async () => {
        await signOut();
        router.replace('/login');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ============================================================
                1. STATIC HEADER (Fixed Top)
               ============================================================ */}
            <View style={styles.staticHeader}>
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.headerBg}
                >
                    <LinearGradient
                        colors={isOnline ? ['rgba(15, 23, 42, 0.85)', 'rgba(15, 23, 42, 0.95)'] : ['rgba(71, 85, 105, 0.9)', 'rgba(100, 116, 139, 0.95)']}
                        style={styles.gradient}
                    >

                        {/* Top Row: Menu + Status + Bell */}
                        <View style={styles.topRow}>
                            <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.iconBtn}>
                                <Ionicons name="menu" size={24} color="#fff" />
                            </TouchableOpacity>

                            {/* ONLINE TOGGLE */}
                            <TouchableOpacity style={[styles.statusPill, isOnline ? styles.pillOnline : styles.pillOffline]} onPress={toggleOnlineStatus}>
                                <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#94A3B8' }]} />
                                <Text style={styles.statusText}>
                                    {isOnline ? (t('goOnline') || "Online") : (t('goOffline') || "Offline")}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.iconBtn}>
                                <Ionicons name="notifications-outline" size={24} color="#fff" />
                                <View style={styles.redDot} />
                            </TouchableOpacity>
                        </View>

                        {/* Greeting */}
                        <View style={styles.greetingBox}>
                            <Text style={styles.greeting}>{t('welcomeBack')}</Text>
                            <Text style={styles.username}>{profile?.full_name || t('providerFallback')}</Text>
                        </View>

                    </LinearGradient>
                </ImageBackground>

                {/* --- FLOATING COMMAND CARD --- */}
                <View style={styles.commandCard}>
                    {/* Wallet */}
                    <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>{t('availableBalance')}</Text>
                        <Text style={styles.statAmount}>{stats.balance.toLocaleString()} CFA</Text>
                        <TouchableOpacity onPress={() => router.push('/provider/earnings')}>
                            <Text style={styles.linkText}>{t('openWallet')} ›</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.verticalDivider} />

                    {/* Active Jobs */}
                    <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>{t('clientDashboard.activeProjects')}</Text>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                            <Text style={styles.statBigNumber}>{stats.activeJobs}</Text>
                            {stats.activeJobs > 0 && (
                                <View style={styles.liveBadge}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>LIVE</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => router.push('/provider/active-jobs')}>
                            <Text style={styles.linkText}>{t('common.seeAll')} ›</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* ============================================================
                2. SCROLLABLE CONTENT (Menu & Tips)
               ============================================================ */}
            <ScrollView
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A"/>}
                showsVerticalScrollIndicator={false}
                style={styles.scrollArea}
            >
                <Text style={styles.sectionTitle}>{t('accountMenuTitle')}</Text>

                <View style={styles.grid}>
                    {/* 1. Find Work */}
                    <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/provider/market')}>
                        <View style={[styles.iconCircle, {backgroundColor: '#EFF6FF'}]}>
                            <Ionicons name="search" size={24} color="#3B82F6" />
                        </View>
                        <Text style={styles.gridTitle}>{t('marketTitle')}</Text>
                        <Text style={styles.gridSub}>Browse jobs</Text>
                    </TouchableOpacity>

                    {/* 2. Requests */}
                    <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/provider/requests')}>
                        <View style={[styles.iconCircle, {backgroundColor: '#FFF7ED'}]}>
                            <Ionicons name="mail-unread" size={24} color="#F97316" />
                        </View>
                        <Text style={styles.gridTitle}>{t('requestsTab')}</Text>
                        <Text style={styles.gridSub}>{stats.pendingRequests} Pending</Text>
                    </TouchableOpacity>

                    {/* 3. My Sites */}
                    <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/provider/active-jobs')}>
                        <View style={[styles.iconCircle, {backgroundColor: '#F0FDF4'}]}>
                            <Ionicons name="construct" size={24} color="#16A34A" />
                        </View>
                        <Text style={styles.gridTitle}>{t('sitesTitle')}</Text>
                        <Text style={styles.gridSub}>Update progress</Text>
                    </TouchableOpacity>

                    {/* 4. Profile */}
                    <TouchableOpacity style={styles.gridCard} onPress={() => router.push('/provider/profile')}>
                        <View style={[styles.iconCircle, {backgroundColor: '#F1F5F9'}]}>
                            <Ionicons name="person" size={24} color="#64748B" />
                        </View>
                        <Text style={styles.gridTitle}>{t('tabProfile')}</Text>
                        <Text style={styles.gridSub}>Verification & Info</Text>
                    </TouchableOpacity>
                </View>

                {/* TIP CARD */}
                <View style={styles.tipCard}>
                    <View style={styles.tipContent}>
                        <Ionicons name="bulb" size={24} color="#F59E0B" />
                        <View style={{flex: 1}}>
                            <Text style={styles.tipTitle}>Pro Tip</Text>
                            <Text style={styles.tipText}>Keep your status "Online" to appear at the top of client searches.</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>

            {/* --- MENU MODAL --- */}
            <Modal visible={menuOpen} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuOpen(false)} activeOpacity={1}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>{t('accountMenuTitle')}</Text>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/provider/settings'); }}>
                            <Ionicons name="settings-outline" size={20} color="#0F172A" />
                            <Text style={styles.modalText}>{t('accountSettings')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); handleSignOut(); }}>
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                            <Text style={[styles.modalText, { color: '#EF4444' }]}>{t('signOut')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // --- STATIC HEADER ---
    staticHeader: { width: '100%', height: 280, zIndex: 10, backgroundColor: '#F8FAFC' },
    headerBg: { width: '100%', height: 230 },
    gradient: { flex: 1, paddingTop: 50, paddingHorizontal: 24 },

    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    iconBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    redDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },

    // STATUS PILL
    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    pillOnline: { borderColor: '#22C55E' },
    pillOffline: { borderColor: '#94A3B8' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    greetingBox: { marginTop: 0 },
    greeting: { color: '#94A3B8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
    username: { color: '#fff', fontSize: 26, fontWeight: '800' },

    // --- FLOATING COMMAND CARD ---
    commandCard: { flexDirection: 'row', position: 'absolute', bottom: 0, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, height: 110, alignItems: 'center' },
    statBlock: { flex: 1, gap: 4 },
    statLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
    statAmount: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    statBigNumber: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    linkText: { fontSize: 12, color: '#3B82F6', fontWeight: '600', marginTop: 2 },
    verticalDivider: { width: 1, height: '70%', backgroundColor: '#E2E8F0', marginHorizontal: 20 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
    liveText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },

    // --- SCROLL CONTENT ---
    scrollArea: { flex: 1, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 16 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridCard: { width: '48%', backgroundColor: '#fff', padding: 16, borderRadius: 20, gap: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
    iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    gridTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    gridSub: { fontSize: 12, color: '#94A3B8' },

    // TIP CARD
    tipCard: { marginVertical: 24, backgroundColor: '#FFFBEB', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#FEF3C7' },
    tipContent: { flexDirection: 'row', gap: 16, alignItems: 'center' },
    tipTitle: { fontSize: 16, fontWeight: '800', color: '#B45309', marginBottom: 4 },
    tipText: { fontSize: 13, color: '#92400E', lineHeight: 20 },

    // MODAL
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
});
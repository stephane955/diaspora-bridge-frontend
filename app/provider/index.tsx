import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    RefreshControl, StatusBar, ImageBackground, Modal
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';

export default function ProviderDashboard() {
    const insets = useSafeAreaInsets();
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
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.surface} />}
            >
                {/* --- HERO SECTION --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab' }}
                    style={styles.heroContainer}
                >
                    <LinearGradient
                        colors={isOnline ? ['rgba(15, 23, 42, 0.9)', 'rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.4)'] : ['rgba(71, 85, 105, 0.9)', 'rgba(71, 85, 105, 0.6)', 'rgba(71, 85, 105, 0.4)']}
                        style={styles.heroGradient}
                    >
                        <View style={[styles.topBar, { paddingTop: insets.top }]}>
                            <View style={styles.heroTitleRow}>
                                <TouchableOpacity onPress={() => setMenuOpen(true)}>
                                    <Image
                                        source={{ uri: profile?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=provider' }}
                                        style={styles.avatar}
                                    />
                                </TouchableOpacity>
                                <View>
                                    <Text style={styles.helloText}>{t('welcomeBack')}</Text>
                                    <Text style={styles.userName}>{profile?.full_name?.split(' ')[0] || t('providerFallback')}</Text>
                                </View>
                            </View>
                            <View style={styles.headerActions}>
                                <TouchableOpacity style={[styles.statusPill, isOnline ? styles.pillOnline : styles.pillOffline]} onPress={toggleOnlineStatus}>
                                    <View style={[styles.statusDot, { backgroundColor: isOnline ? theme.colors.success : theme.colors.textSubtle }]} />
                                    <Text style={styles.statusText}>
                                        {isOnline ? (t('goOnline') || "Online") : (t('goOffline') || "Offline")}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.glassIconBtn} onPress={() => router.push('/notifications')}>
                                    <Ionicons name="notifications" size={20} color="#fff" />
                                    <View style={styles.redDot} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.glassIconBtn} onPress={() => setMenuOpen(true)}>
                                    <Ionicons name="menu" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.balanceSection}>
                            <Text style={styles.balanceLabel}>{t('availableBalance')?.toUpperCase() || 'TOTAL EARNINGS'}</Text>
                            <Text style={styles.balanceAmount}>{stats.balance.toLocaleString()} CFA</Text>
                            <TouchableOpacity style={styles.secureBadge} onPress={() => router.push('/provider/earnings')}>
                                <Ionicons name="wallet" size={12} color={theme.colors.success} />
                                <Text style={styles.secureText}>{t('openWallet') || "Open Wallet"}</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                {/* --- FLOATING STATS CARD --- */}
                <View style={styles.floatingCardWrap}>
                    <BlurView intensity={60} tint="dark" style={styles.floatingStatsCard}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.activeJobs}</Text>
                            <Text style={styles.statLabel}>Active Sites</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.pendingRequests}</Text>
                            <Text style={styles.statLabel}>Pending Requests</Text>
                        </View>
                    </BlurView>
                </View>

                {/* --- QUICK ACTIONS --- */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/provider/market')}>
                        <View style={styles.quickActionIcon}>
                            <Ionicons name="search" size={24} color={theme.colors.text} />
                        </View>
                        <Text style={styles.quickActionLabel}>Find Work</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/provider/request-payout')}>
                        <View style={styles.quickActionIcon}>
                            <Ionicons name="wallet" size={22} color="#0F172A" />
                        </View>
                        <Text style={styles.quickActionLabel}>Withdraw</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/provider/active')}>
                        <View style={styles.quickActionIcon}>
                            <Ionicons name="briefcase" size={22} color="#0F172A" />
                        </View>
                        <Text style={styles.quickActionLabel}>My Sites</Text>
                    </TouchableOpacity>
                </View>

                {/* --- FEED / CARDS --- */}
                <View style={styles.bodyContent}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('accountMenuTitle')}</Text>
                    </View>

                    <View style={styles.feedGrid}>
                        <TouchableOpacity style={styles.feedCard} onPress={() => router.push('/provider/market')}>
                            <View style={styles.feedCardIconWrap}>
                                <Ionicons name="search" size={24} color="#0EA5E9" />
                            </View>
                            <Text style={styles.feedCardTitle}>{t('marketTitle')}</Text>
                            <Text style={styles.feedCardSub}>Browse jobs</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.feedCard} onPress={() => router.push('/provider/requests')}>
                            <View style={styles.feedCardIconWrap}>
                                <Ionicons name="mail-unread" size={24} color="#F59E0B" />
                            </View>
                            <Text style={styles.feedCardTitle}>{t('requestsTab')}</Text>
                            <Text style={styles.feedCardSub}>{stats.pendingRequests} Pending</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.feedCard} onPress={() => router.push('/provider/active')}>
                            <View style={styles.feedCardIconWrap}>
                                <Ionicons name="briefcase" size={24} color="#16A34A" />
                            </View>
                            <Text style={styles.feedCardTitle}>{t('sitesTitle')}</Text>
                            <Text style={styles.feedCardSub}>Update progress</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.feedCard} onPress={() => router.push('/provider/profile')}>
                            <View style={styles.feedCardIconWrap}>
                                <Ionicons name="person" size={24} color="#64748B" />
                            </View>
                            <Text style={styles.feedCardTitle}>{t('tabProfile')}</Text>
                            <Text style={styles.feedCardSub}>Verification & Info</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tipCard}>
                        <View style={styles.tipContent}>
                            <Ionicons name="bulb" size={24} color="#F59E0B" />
                            <View style={styles.tipTextWrap}>
                                <Text style={styles.tipTitle}>Pro Tip</Text>
                                <Text style={styles.tipText}>Keep your status "Online" to appear at the top of client searches.</Text>
                            </View>
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
    container: { flex: 1, backgroundColor: theme.colors.background },

    // --- HERO ---
    heroContainer: { width: '100%', height: 340 },
    heroGradient: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 28 },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
    heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
    helloText: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginBottom: 2, letterSpacing: -0.5 },
    userName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    glassIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    redDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#fff' },

    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    pillOnline: { borderColor: '#16A34A' },
    pillOffline: { borderColor: '#94A3B8' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { color: '#fff', fontWeight: '800', fontSize: 12 },

    balanceSection: { marginBottom: 0 },
    balanceLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
    secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(22, 163, 74, 0.15)', borderWidth: 1, borderColor: 'rgba(22, 163, 74, 0.25)' },
    secureText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },

    // --- FLOATING STATS CARD ---
    floatingCardWrap: { marginTop: -40, paddingHorizontal: 20 },
    floatingStatsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
    },
    statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '700' },
    statDivider: { width: 1, height: '60%', backgroundColor: 'rgba(255,255,255,0.2)' },

    // --- QUICK ACTIONS ---
    quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
    quickActionBtn: { alignItems: 'center', gap: 8 },
    quickActionIcon: { width: 56, height: 56, borderRadius: theme.radii.md, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadow.soft },
    quickActionLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },

    bodyContent: { paddingTop: 8, paddingHorizontal: theme.spacing.lg },
    sectionHeader: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },

    feedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    feedCard: {
        width: '48%',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.xl,
        ...theme.shadow.soft,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    feedCardIconWrap: { width: 48, height: 48, borderRadius: theme.radii.md, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
    feedCardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
    feedCardSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, fontWeight: '600' },

    tipCard: { marginVertical: theme.spacing.xl, padding: theme.spacing.lg, borderRadius: theme.radii.xl, backgroundColor: theme.colors.warning + '15', borderWidth: 1, borderColor: theme.colors.warning + '40', ...theme.shadow.soft },
    tipContent: { flexDirection: 'row', gap: 16, alignItems: 'center' },
    tipTextWrap: { flex: 1 },
    tipTitle: { fontSize: 16, fontWeight: '800', color: '#B45309', marginBottom: 4 },
    tipText: { fontSize: 13, color: '#92400E', lineHeight: 20 },

    modalOverlay: { flex: 1, backgroundColor: theme.colors.glassDark, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: theme.colors.surface, padding: theme.spacing.xl, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: theme.spacing.lg },
    modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing.md, letterSpacing: -0.5 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    modalText: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
});
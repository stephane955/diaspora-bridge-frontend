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
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';
import { mediumFeedback } from '@/utils/haptics';

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
            <NavigationBar
                title={profile?.full_name?.split(' ')[0] || t('providerDashboardTitle') || 'Home'}
                subtitle={isOnline ? "Online & available" : "Currently offline"}
                showBack={false}
                onRefresh={() => router.push('/provider/inbox')}
                onMenuPress={() => setMenuOpen(true)}
                dynamicColor={isOnline ? theme.colors.emerald : theme.colors.textSubtle}
                showNotifDot={stats.pendingRequests > 0}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: theme.spacing.lg }}
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

                {/* --- QUICK ACTIONS (Colorful) --- */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/market'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[theme.colors.active, theme.colors.activeSoft]} style={styles.quickActionIconColor}>
                            <Ionicons name="search" size={24} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>Find Work</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/request-payout'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[theme.colors.emerald, theme.colors.emeraldSoft]} style={styles.quickActionIconColor}>
                            <Ionicons name="wallet" size={22} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>Withdraw</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/active'); }} activeOpacity={0.7}>
                        <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.quickActionIconColor}>
                            <Ionicons name="briefcase" size={22} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>My Sites</Text>
                    </TouchableOpacity>
                </View>

                {/* --- FEED / CARDS --- */}
                <View style={styles.bodyContent}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('accountMenuTitle')}</Text>
                    </View>

                    <View style={styles.feedGrid}>
                        <TouchableOpacity style={styles.feedCard} onPress={() => { mediumFeedback(); router.push('/provider/market'); }} activeOpacity={0.7}>
                            <LinearGradient colors={[theme.colors.active + '20', theme.colors.active + '08']} style={styles.feedCardIconWrap}>
                                <Ionicons name="search" size={24} color={theme.colors.active} />
                            </LinearGradient>
                            <Text style={styles.feedCardTitle}>{t('marketTitle')}</Text>
                            <Text style={styles.feedCardSub}>Browse jobs</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.feedCard} onPress={() => { mediumFeedback(); router.push('/provider/requests'); }} activeOpacity={0.7}>
                            <LinearGradient colors={[theme.colors.warning + '20', theme.colors.warning + '08']} style={styles.feedCardIconWrap}>
                                <Ionicons name="mail-unread" size={24} color={theme.colors.warning} />
                            </LinearGradient>
                            <Text style={styles.feedCardTitle}>{t('requestsTab')}</Text>
                            <Text style={[styles.feedCardSub, stats.pendingRequests > 0 && { color: theme.colors.warning, fontWeight: '800' }]}>{stats.pendingRequests} Pending</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.feedCard} onPress={() => { mediumFeedback(); router.push('/provider/active'); }} activeOpacity={0.7}>
                            <LinearGradient colors={[theme.colors.emerald + '20', theme.colors.emerald + '08']} style={styles.feedCardIconWrap}>
                                <Ionicons name="briefcase" size={24} color={theme.colors.emerald} />
                            </LinearGradient>
                            <Text style={styles.feedCardTitle}>{t('sitesTitle')}</Text>
                            <Text style={styles.feedCardSub}>Update progress</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.feedCard} onPress={() => { mediumFeedback(); router.push('/provider/profile'); }} activeOpacity={0.7}>
                            <LinearGradient colors={['#6366F120', '#6366F108']} style={styles.feedCardIconWrap}>
                                <Ionicons name="person" size={24} color="#6366F1" />
                            </LinearGradient>
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

            {/* --- FULL NAVIGATION MENU --- */}
            <Modal visible={menuOpen} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuOpen(false)} activeOpacity={1}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Navigate</Text>

                        <Text style={styles.modalSection}>Work</Text>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/market'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.active + '18' }]}><Ionicons name="search" size={20} color={theme.colors.active} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Find Work</Text><Text style={styles.modalSub}>Browse available jobs near you</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/active'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.emerald + '18' }]}><Ionicons name="briefcase" size={20} color={theme.colors.emerald} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Active Sites</Text><Text style={styles.modalSub}>Upload progress, manage milestones</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/requests'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.warning + '18' }]}><Ionicons name="mail-unread" size={20} color={theme.colors.warning} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Requests</Text><Text style={styles.modalSub}>{stats.pendingRequests} pending invitations</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>

                        <View style={styles.divider} />
                        <Text style={styles.modalSection}>Money</Text>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/earnings'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.emerald + '18' }]}><Ionicons name="cash" size={20} color={theme.colors.emerald} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Earnings</Text><Text style={styles.modalSub}>Balance, transactions, withdraw</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/payout-setup'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: '#6366F118' }]}><Ionicons name="card" size={20} color="#6366F1" /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Payout Setup</Text><Text style={styles.modalSub}>MOMO, OM, bank details</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/suppliers'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.emeraldSoft + '40' }]}><Ionicons name="storefront" size={20} color={theme.colors.emerald} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Partner Suppliers</Text><Text style={styles.modalSub}>Zero-fraud materials, B2B cart</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>

                        <View style={styles.divider} />
                        <Text style={styles.modalSection}>Account</Text>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/profile'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.active + '18' }]}><Ionicons name="person" size={20} color={theme.colors.active} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>{t('tabProfile')}</Text><Text style={styles.modalSub}>Skills, portfolio, verification</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/verification'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.emerald + '18' }]}><Ionicons name="shield-checkmark" size={20} color={theme.colors.emerald} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Verification</Text><Text style={styles.modalSub}>ID check, trust badge</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); router.push('/provider/settings'); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.surfaceAlt }]}><Ionicons name="settings" size={20} color={theme.colors.textMuted} /></View>
                            <View style={{ flex: 1 }}><Text style={styles.modalText}>Settings</Text><Text style={styles.modalSub}>Language, notifications</Text></View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
                        </TouchableOpacity>

                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.modalItem} onPress={() => { mediumFeedback(); setMenuOpen(false); handleSignOut(); }} activeOpacity={0.7}>
                            <View style={[styles.modalIconBox, { backgroundColor: theme.colors.danger + '15' }]}><Ionicons name="log-out-outline" size={20} color={theme.colors.danger} /></View>
                            <Text style={[styles.modalText, { color: theme.colors.danger }]}>{t('signOut')}</Text>
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
    quickActionIconColor: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...theme.shadow.glow },
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
    feedCardIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
    feedCardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
    feedCardSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, fontWeight: '600' },

    tipCard: { marginVertical: theme.spacing.xl, padding: theme.spacing.lg, borderRadius: theme.radii.xl, backgroundColor: theme.colors.warning + '15', borderWidth: 1, borderColor: theme.colors.warning + '40', ...theme.shadow.soft },
    tipContent: { flexDirection: 'row', gap: 16, alignItems: 'center' },
    tipTextWrap: { flex: 1 },
    tipTitle: { fontSize: 16, fontWeight: '800', color: '#B45309', marginBottom: 4 },
    tipText: { fontSize: 13, color: '#92400E', lineHeight: 20 },

    modalOverlay: { flex: 1, backgroundColor: theme.colors.glassDark, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: theme.colors.surface, padding: theme.spacing.xl, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl, paddingBottom: 40, maxHeight: '85%' },
    modalHandle: { width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: theme.spacing.md },
    modalTitle: { fontSize: 22, ...theme.typography.title, color: theme.colors.text, marginBottom: 4 },
    modalSection: { fontSize: 11, ...theme.typography.label, color: theme.colors.textSubtle, marginTop: theme.spacing.md, marginBottom: 4 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 12 },
    modalIconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    modalText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    modalSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: 4 },
});
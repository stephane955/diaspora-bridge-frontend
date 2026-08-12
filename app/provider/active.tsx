import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    RefreshControl, ScrollView, ImageBackground, StatusBar, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import PulseLoader from '@/components/PulseLoader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { SCROLL_BOTTOM_INSET, PREMIUM_BG, PREMIUM_GOLD, PREMIUM_MUTED } from '@/constants/layout';

export default function ActiveSites() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<'active' | 'applied'>('active');
    const [projects, setProjects] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ pendingRequests: 0, balance: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileData) setProfile(profileData);

            const { data: activeData } = await supabase
                .from('projects')
                .select('*')
                .eq('assigned_provider_id', user.id)
                .in('status', ['in_progress', 'In Progress'])
                .order('updated_at', { ascending: false });

            const { data: appliedData } = await supabase
                .from('project_applications')
                .select('*, projects(title, city, budget, status)')
                .eq('provider_id', user.id)
                .eq('status', 'pending');

            const { count: requestsCount } = await supabase
                .from('project_applications')
                .select('*', { count: 'exact', head: true })
                .eq('provider_id', user.id)
                .eq('status', 'pending');

            const { data: tx } = await supabase.from('transactions').select('amount').eq('user_id', user.id);
            const balance = tx?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            if (activeData) setProjects(activeData);
            if (appliedData) setApplications(appliedData);
            setStats({ pendingRequests: requestsCount || 0, balance });
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const isOnline = profile?.is_online !== false;

    const renderActive = ({ item }: { item: any }) => (
        <Pressable
            style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.92 }]}
            onPress={() => router.push(`/provider/project/${item.id}`)}
        >
            <View style={styles.activeHeader}>
                <View style={styles.liveBadge}>
                    <View style={styles.pulsingDot} />
                    <Text style={styles.liveText}>{t('liveSite')}</Text>
                </View>
                <Text style={styles.dateText}>
                    {t('started')} {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>

            <View style={styles.activeContent}>
                <Text style={styles.activeTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={16} color={PREMIUM_MUTED} />
                    <Text style={styles.locationText}>{item.city}</Text>
                </View>
            </View>

            <View style={styles.actionBar}>
                <View style={styles.actionLeft}>
                    <Text style={styles.nextTaskLabel}>{t('nextTask')}</Text>
                    <Text style={styles.nextTaskValue}>{t('uploadProof')}</Text>
                </View>
                <View style={styles.actionBarBtns}>
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => { mediumFeedback(); router.push(`/provider/add-receipt?projectId=${item.id}`); }}
                    >
                        <Ionicons name="receipt-outline" size={16} color="#fff" />
                        <Text style={styles.toolBtnText}>{t('receipt')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => { mediumFeedback(); router.push(`/provider/material-cart?projectId=${item.id}`); }}
                    >
                        <Ionicons name="cart-outline" size={16} color="#fff" />
                        <Text style={styles.toolBtnText}>{t('cart')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.enterBtn}
                        onPress={() => { successFeedback(); router.push(`/provider/project/${item.id}`); }}
                    >
                        <Text style={styles.enterText}>{t('open')}</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </Pressable>
    );

    const renderApplied = ({ item }: { item: any }) => (
        <View style={styles.ticketCard}>
            <View style={[styles.statusStrip, { backgroundColor: '#F59E0B' }]} />
            <View style={styles.ticketContent}>
                <View style={styles.ticketHeader}>
                    <Text style={styles.ticketTitle}>{item.projects?.title || t('unknownLocation')}</Text>
                    <View style={styles.pendingTag}>
                        <Text style={styles.pendingTagText}>{t('pending')}</Text>
                    </View>
                </View>
                <View style={styles.ticketInfo}>
                    <View>
                        <Text style={styles.ticketLabel}>{t('clientBudget')}</Text>
                        <Text style={styles.ticketValue}>
                            {item.projects?.budget ? item.projects.budget.toLocaleString() : 'N/A'} CFA
                        </Text>
                    </View>
                    <View style={styles.verticalLine} />
                    <View>
                        <Text style={styles.ticketLabel}>{t('yourBid')}</Text>
                        <Text style={[styles.ticketValue, { color: '#F8FAFC' }]}>
                            {item.bid_amount?.toLocaleString()} CFA
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const listHeader = (
        <>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop' }}
                style={styles.heroContainer}
            >
                <LinearGradient
                    colors={isOnline
                        ? ['rgba(10,15,26,0.95)', 'rgba(10,15,26,0.7)', 'rgba(10,15,26,0.4)']
                        : ['rgba(71,85,105,0.95)', 'rgba(71,85,105,0.7)', 'rgba(71,85,105,0.4)']}
                    style={styles.heroGradient}
                >
                    <View style={styles.balanceSection}>
                        <Text style={styles.balanceLabel}>{t('availableBalance').toUpperCase()}</Text>
                        <Text style={styles.balanceAmount}>{stats.balance.toLocaleString()} CFA</Text>
                        <TouchableOpacity style={styles.secureBadge} onPress={() => router.push('/provider/earnings')}>
                            <Ionicons name="wallet" size={12} color="#16A34A" />
                            <Text style={styles.secureText}>{t('openWallet')}</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </ImageBackground>

            <View style={styles.floatingCardWrap}>
                <BlurView intensity={60} tint="dark" style={styles.floatingStatsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{projects.length}</Text>
                        <Text style={styles.statLabel}>{t('activeSitesLabel')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.pendingRequests}</Text>
                        <Text style={styles.statLabel}>{t('pendingRequestsLabel')}</Text>
                    </View>
                </BlurView>
            </View>

            <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/market'); }}>
                    <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.quickActionIcon}>
                        <Ionicons name="search" size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.quickActionLabel}>{t('marketTitle')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/cart-hub'); }}>
                    <LinearGradient colors={['#10B981', '#059669']} style={styles.quickActionIcon}>
                        <Ionicons name="scan" size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.quickActionLabel}>{t('cartHubTitle')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/requests'); }}>
                    <LinearGradient colors={['#D4AF37', '#B8860B']} style={styles.quickActionIcon}>
                        <Ionicons name="mail-unread" size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.quickActionLabel}>{t('requestsTab')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/earnings'); }}>
                    <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.quickActionIcon}>
                        <Ionicons name="cash" size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.quickActionLabel}>{t('walletTitle')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                    onPress={() => setActiveTab('active')}
                >
                    <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                        {t('clientDashboard.activeProjects')} ({projects.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'applied' && styles.activeTab]}
                    onPress={() => setActiveTab('applied')}
                >
                    <Text style={[styles.tabText, activeTab === 'applied' && styles.activeTabText]}>
                        {t('tabApplied')} ({applications.length})
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.screen}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                <PremiumHeader
                    title={t('tabActive')}
                    subtitle={t('providerHomeSubtitle')}
                    menuItems={providerMenuItems(router, t)}
                    onNotificationsPress={() => router.push('/provider/inbox')}
                />
                <View style={styles.center}><PulseLoader color={theme.colors.emerald} /></View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={profile?.full_name?.split(' ')[0] || t('tabActive')}
                subtitle={isOnline ? t('onlineAvailable') : t('offlineStatus')}
                menuItems={providerMenuItems(router, t)}
                onNotificationsPress={() => router.push('/provider/inbox')}
            />

            <FlatList
                data={activeTab === 'active' ? projects : applications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={activeTab === 'active' ? renderActive : renderApplied}
                ListHeaderComponent={listHeader}
                contentContainerStyle={{
                    paddingTop: insets.top + 72,
                    paddingBottom: SCROLL_BOTTOM_INSET,
                    paddingHorizontal: theme.spacing.lg,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PREMIUM_GOLD} />}
                ListEmptyComponent={
                    <PremiumEmptyState
                        icon={activeTab === 'active' ? 'hammer-outline' : 'document-text-outline'}
                        title={activeTab === 'active' ? (t('noActiveJobs') ?? 'No active jobs') : (t('noApplications') ?? 'No applications')}
                        subtitle={
                            activeTab === 'active'
                                ? (t('clientDashboard.noProjects') ?? 'Browse the market and win a site to get started.')
                                : (t('checkMarketHint') ?? 'Apply to open jobs in the market to fill this list.')
                        }
                        actionLabel={t('marketTitle') ?? 'Browse Market'}
                        onAction={() => {
                            successFeedback();
                            router.push('/provider/market');
                        }}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    heroContainer: { width: '100%', height: 200, borderRadius: 24, overflow: 'hidden', marginBottom: 8 },
    heroGradient: { flex: 1, padding: 20, justifyContent: 'flex-end' },
    balanceSection: { gap: 4 },
    balanceLabel: { color: PREMIUM_MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    balanceAmount: { color: '#F8FAFC', fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
    secureBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
        backgroundColor: 'rgba(22,163,74,0.15)', borderWidth: 1, borderColor: 'rgba(22,163,74,0.25)',
    },
    secureText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },

    floatingCardWrap: { marginTop: -28, marginBottom: 16 },
    floatingStatsCard: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', color: '#F8FAFC' },
    statLabel: { fontSize: 11, color: PREMIUM_MUTED, marginTop: 4, fontWeight: '700' },
    statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

    quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
    quickActionBtn: { flex: 1, alignItems: 'center', gap: 8 },
    quickActionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    quickActionLabel: { fontSize: 11, fontWeight: '700', color: PREMIUM_MUTED, textAlign: 'center' },

    tabContainer: {
        flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 4, marginBottom: 16,
    },
    tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    activeTab: { backgroundColor: 'rgba(37,99,235,0.35)' },
    tabText: { color: PREMIUM_MUTED, fontWeight: '700', fontSize: 12 },
    activeTabText: { color: '#F8FAFC' },

    activeCard: {
        backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 20, marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    },
    activeHeader: {
        flexDirection: 'row', justifyContent: 'space-between', padding: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
    },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(22,163,74,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
    liveText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
    dateText: { color: PREMIUM_MUTED, fontSize: 12, fontWeight: '500' },
    activeContent: { padding: 20 },
    activeTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { color: PREMIUM_MUTED, fontWeight: '500' },
    actionBar: {
        backgroundColor: 'rgba(0,0,0,0.25)', padding: 16, flexDirection: 'row',
        justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    },
    actionLeft: { gap: 2, flex: 1, marginRight: 8 },
    nextTaskLabel: { fontSize: 10, fontWeight: '700', color: PREMIUM_MUTED },
    nextTaskValue: { fontSize: 13, fontWeight: '600', color: '#CBD5E1' },
    actionBarBtns: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
    toolBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, gap: 4 },
    toolBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
    enterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: PREMIUM_GOLD, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 4 },
    enterText: { color: '#0A0F1A', fontWeight: '800', fontSize: 12 },

    ticketCard: {
        flexDirection: 'row', backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 16, marginBottom: 12,
        overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    statusStrip: { width: 6, height: '100%' },
    ticketContent: { flex: 1, padding: 16 },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    ticketTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', flex: 1, marginRight: 10 },
    pendingTag: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
    pendingTagText: { fontSize: 10, fontWeight: '800', color: '#F59E0B' },
    ticketInfo: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    ticketLabel: { fontSize: 10, color: PREMIUM_MUTED, fontWeight: '700', marginBottom: 2 },
    ticketValue: { fontSize: 14, fontWeight: '600', color: PREMIUM_MUTED },
    verticalLine: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)' },

});

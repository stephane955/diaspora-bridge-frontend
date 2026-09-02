import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    RefreshControl, ImageBackground, StatusBar, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { fetchUserAvailableBalanceMinor } from '@/lib/ledgerBalance';
import { resolveProjectBudgetMinor, formatBudgetDisplay } from '@/lib/money';
import { P00_BALANCE_UNAVAILABLE } from '@/constants/p00Security';
import {
    ALPHA,
    GOLD,
    GOLD_DEEP,
    GOLD_TINT,
    INFO,
    SUCCESS,
    SUCCESS_DEEP,
    WARNING,
    font,
    icon as iconSize,
    radius,
    space,
    text,
    tint,
    weight,
    withAlpha,
} from '@/constants/design';

export default function ActiveSites() {
    const offsets = useScreenOffsets();
    const c = usePremiumColors();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'applied'>('active');
    const [projects, setProjects] = useState<any[]>([]);
    const [completedProjects, setCompletedProjects] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState<{ pendingRequests: number; balance: number | null }>({
        pendingRequests: 0,
        balance: null,
    });
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

            const { data: completedData } = await supabase
                .from('projects')
                .select('*, reviews(rating, comment, created_at)')
                .eq('assigned_provider_id', user.id)
                .eq('status', 'completed')
                .order('updated_at', { ascending: false })
                .limit(20);

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

            const balanceMinor = await fetchUserAvailableBalanceMinor();

            if (activeData) setProjects(activeData);
            if (completedData) setCompletedProjects(completedData);
            if (appliedData) setApplications(appliedData);
            setStats({
                pendingRequests: requestsCount || 0,
                balance: balanceMinor === null ? null : Number(balanceMinor),
            });
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
            style={({ pressed }) => [
                styles.activeCard,
                { backgroundColor: c.surface, borderColor: c.border },
                pressed && { opacity: 0.92 },
            ]}
            onPress={() => router.push(`/provider/project/${item.id}`)}
        >
            <View style={[styles.activeHeader, { borderBottomColor: c.border }]}>
                <View style={styles.liveBadge}>
                    <View style={styles.pulsingDot} />
                    <Text style={styles.liveText}>{t('liveSite')}</Text>
                </View>
                <Text style={[styles.dateText, { color: c.muted }]}>
                    {t('started')} {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>

            <View style={styles.activeContent}>
                <Text style={[styles.activeTitle, { color: c.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={iconSize.sm} color={c.muted} />
                    <Text style={[styles.locationText, { color: c.muted }]}>{item.city}</Text>
                </View>
            </View>

            <View style={[styles.actionBar, { backgroundColor: c.surfaceAlt, borderTopColor: c.border }]}>
                <View style={styles.actionLeft}>
                    <Text style={[styles.nextTaskLabel, { color: c.muted }]}>{t('nextTask')}</Text>
                    <Text style={[styles.nextTaskValue, { color: c.textSecondary }]}>{t('uploadProof')}</Text>
                </View>
                <View style={styles.actionBarBtns}>
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => { mediumFeedback(); router.push(`/provider/add-receipt?projectId=${item.id}`); }}
                    >
                        <Ionicons name="receipt-outline" size={iconSize.xs} color="#FFFFFF" />
                        <Text style={styles.toolBtnText}>{t('receipt')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => { mediumFeedback(); router.push(`/provider/material-cart?projectId=${item.id}`); }}
                    >
                        <Ionicons name="cart-outline" size={iconSize.xs} color="#FFFFFF" />
                        <Text style={styles.toolBtnText}>{t('cart')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.enterBtn}
                        onPress={() => { successFeedback(); router.push(`/provider/project/${item.id}`); }}
                    >
                        <Text style={styles.enterText}>{t('open')}</Text>
                        <Ionicons name="arrow-forward" size={iconSize.xs} color="#0A0F1A" />
                    </TouchableOpacity>
                </View>
            </View>
        </Pressable>
    );

    const renderCompleted = ({ item }: { item: any }) => {
        const review = Array.isArray(item.reviews) ? item.reviews[0] : item.reviews;
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.activeCard,
                    { backgroundColor: c.surface, borderColor: c.border },
                    pressed && { opacity: 0.92 },
                ]}
                onPress={() => router.push(`/provider/project/${item.id}`)}
            >
                <View style={[styles.activeHeader, { borderBottomColor: c.border }]}>
                    <View style={[styles.liveBadge, { backgroundColor: withAlpha(GOLD, ALPHA.medium) }]}>
                        <Ionicons name="checkmark-circle" size={iconSize.xs} color={GOLD} />
                        <Text style={[styles.liveText, { color: GOLD }]}>{t('completedTitle')}</Text>
                    </View>
                    <Text style={[styles.dateText, { color: c.muted }]}>
                        {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                    </Text>
                </View>

                <View style={styles.activeContent}>
                    <Text style={[styles.activeTitle, { color: c.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.locationRow}>
                        <Ionicons name="location-sharp" size={iconSize.sm} color={c.muted} />
                        <Text style={[styles.locationText, { color: c.muted }]}>{item.city}</Text>
                    </View>
                    {review ? (
                        <View style={styles.reviewSnippet}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Ionicons
                                        key={star}
                                        name={star <= review.rating ? 'star' : 'star-outline'}
                                        size={iconSize.xs}
                                        color={GOLD}
                                    />
                                ))}
                            </View>
                            {review.comment ? (
                                <Text style={[styles.reviewSnippetText, { color: c.textSecondary }]} numberOfLines={2}>
                                    {`“${review.comment}”`}
                                </Text>
                            ) : null}
                        </View>
                    ) : (
                        <Text style={[styles.reviewSnippetText, { color: c.muted }]}>
                            {t('completedStep')}
                        </Text>
                    )}
                </View>
            </Pressable>
        );
    };

    const renderApplied = ({ item }: { item: any }) => (
        <View style={[styles.ticketCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.statusStrip, { backgroundColor: WARNING }]} />
            <View style={styles.ticketContent}>
                <View style={styles.ticketHeader}>
                    <Text style={[styles.ticketTitle, { color: c.textPrimary }]}>{item.projects?.title || t('unknownLocation')}</Text>
                    <View style={styles.pendingTag}>
                        <Text style={styles.pendingTagText}>{t('pending')}</Text>
                    </View>
                </View>
                <View style={styles.ticketInfo}>
                    <View>
                        <Text style={[styles.ticketLabel, { color: c.muted }]}>{t('clientBudget')}</Text>
                        <Text style={[styles.ticketValue, { color: c.muted }]}>
                            {item.projects ? formatBudgetDisplay(resolveProjectBudgetMinor(item.projects)) : 'N/A'}
                        </Text>
                    </View>
                    <View style={[styles.verticalLine, { backgroundColor: c.border }]} />
                    <View>
                        <Text style={[styles.ticketLabel, { color: c.muted }]}>{t('yourBid')}</Text>
                        <Text style={[styles.ticketValue, { color: c.textPrimary }]}>
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
                        <Text style={styles.balanceAmount}>
                            {stats.balance === null
                                ? P00_BALANCE_UNAVAILABLE
                                : `${stats.balance.toLocaleString()} CFA`}
                        </Text>
                        <TouchableOpacity style={styles.secureBadge} onPress={() => router.push('/provider/earnings')}>
                            <Ionicons name="wallet" size={iconSize.xs} color={SUCCESS} />
                            <Text style={styles.secureText}>{t('openWallet')}</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </ImageBackground>

            <View style={styles.floatingCardWrap}>
                <BlurView intensity={60} tint={c.blurTint} style={[styles.floatingStatsCard, { borderColor: c.border }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: c.textPrimary }]}>{projects.length}</Text>
                        <Text style={[styles.statLabel, { color: c.muted }]}>{t('activeSitesLabel')}</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: c.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: c.textPrimary }]}>{stats.pendingRequests}</Text>
                        <Text style={[styles.statLabel, { color: c.muted }]}>{t('pendingRequestsLabel')}</Text>
                    </View>
                </BlurView>
            </View>

            <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/market'); }}>
                    <LinearGradient colors={[INFO, INFO]} style={styles.quickActionIcon}>
                        <Ionicons name="search" size={iconSize.md} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={[styles.quickActionLabel, { color: c.muted }]}>{t('marketTitle')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/cart-hub'); }}>
                    <LinearGradient colors={[SUCCESS, SUCCESS_DEEP]} style={styles.quickActionIcon}>
                        <Ionicons name="scan" size={iconSize.md} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={[styles.quickActionLabel, { color: c.muted }]}>{t('cartHubTitle')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/requests'); }}>
                    <LinearGradient colors={[GOLD, GOLD_DEEP]} style={styles.quickActionIcon}>
                        <Ionicons name="mail-unread" size={iconSize.md} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={[styles.quickActionLabel, { color: c.muted }]}>{t('requestsTab')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/provider/earnings'); }}>
                    <LinearGradient colors={[GOLD, GOLD_DEEP]} style={styles.quickActionIcon}>
                        <Ionicons name="cash" size={iconSize.md} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={[styles.quickActionLabel, { color: c.muted }]}>{t('walletTitle')}</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.tabContainer, { backgroundColor: withAlpha(c.isDark ? '#FFFFFF' : '#0F172A', ALPHA.faint) }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                    onPress={() => setActiveTab('active')}
                >
                    <Text style={[styles.tabText, { color: c.muted }, activeTab === 'active' && { color: c.textPrimary }]}>
                        {t('clientDashboard.activeProjects')} ({projects.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
                    onPress={() => setActiveTab('completed')}
                >
                    <Text style={[styles.tabText, { color: c.muted }, activeTab === 'completed' && { color: c.textPrimary }]}>
                        {t('completedTitle')} ({completedProjects.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'applied' && styles.activeTab]}
                    onPress={() => setActiveTab('applied')}
                >
                    <Text style={[styles.tabText, { color: c.muted }, activeTab === 'applied' && { color: c.textPrimary }]}>
                        {t('tabApplied')} ({applications.length})
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

    if (loading && !refreshing) {
        return (
            <View style={[styles.screen, { backgroundColor: c.bg }]}>
                <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
                <PremiumHeader
                    title={t('tabActive')}
                    subtitle={t('providerHomeSubtitle')}
                    menuItems={providerMenuItems(router, t)}
                    onNotificationsPress={() => router.push('/notifications')}
                />
                <ScreenLoader />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
            <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
            <PremiumHeader
                title={profile?.full_name?.split(' ')[0] || t('tabActive')}
                subtitle={isOnline ? t('onlineAvailable') : t('offlineStatus')}
                menuItems={providerMenuItems(router, t)}
                onNotificationsPress={() => router.push('/notifications')}
            />

            <FlatList
                data={activeTab === 'active' ? projects : activeTab === 'completed' ? completedProjects : applications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={activeTab === 'active' ? renderActive : activeTab === 'completed' ? renderCompleted : renderApplied}
                ListHeaderComponent={listHeader}
                contentContainerStyle={offsets.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
                ListEmptyComponent={
                    <PremiumEmptyState
                        icon={activeTab === 'active' ? 'hammer-outline' : activeTab === 'completed' ? 'checkmark-done-outline' : 'document-text-outline'}
                        title={
                            activeTab === 'active'
                                ? (t('noActiveJobs') ?? 'No active jobs')
                                : activeTab === 'completed'
                                    ? (t('noCompletedHandovers') ?? 'No completed jobs yet')
                                    : (t('noApplications') ?? 'No applications')
                        }
                        subtitle={
                            activeTab === 'active'
                                ? (t('clientDashboard.noProjects') ?? 'Browse the market and win a site to get started.')
                                : activeTab === 'completed'
                                    ? (t('completedHandovers') ?? 'Finished projects and client reviews appear here.')
                                    : (t('checkMarketHint') ?? 'Apply to open jobs in the market to fill this list.')
                        }
                        actionLabel={activeTab === 'completed' ? undefined : (t('marketTitle') ?? 'Browse Market')}
                        onAction={activeTab === 'completed' ? undefined : () => {
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
    screen: { flex: 1 },

    heroContainer: { width: '100%', height: 200, borderRadius: radius.xl, overflow: 'hidden', marginBottom: space.xs },
    heroGradient: { flex: 1, padding: space.lg, justifyContent: 'flex-end' },
    balanceSection: { gap: space.xxs },
    balanceLabel: { color: '#94A3B8', fontSize: font.micro, fontWeight: weight.heavy, letterSpacing: 1 },
    balanceAmount: { ...text.hero, color: '#FFFFFF' },
    secureBadge: {
        flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs, alignSelf: 'flex-start',
        paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill,
        ...tint(SUCCESS),
    },
    secureText: { color: SUCCESS, fontSize: font.caption, fontWeight: weight.heavy },

    floatingCardWrap: { marginTop: -28, marginBottom: space.md },
    floatingStatsCard: {
        flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: space.lg,
        borderWidth: 1, overflow: 'hidden',
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: font.title, fontWeight: weight.heavy },
    statLabel: { fontSize: font.micro, marginTop: space.xxs, fontWeight: weight.heavy },
    statDivider: { width: 1, height: 32 },

    quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.lg, gap: space.xs },
    quickActionBtn: { flex: 1, alignItems: 'center', gap: space.xs },
    quickActionIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    quickActionLabel: { fontSize: font.micro, fontWeight: weight.heavy, textAlign: 'center' },

    tabContainer: {
        flexDirection: 'row', borderRadius: radius.lg, padding: space.xxs, marginBottom: space.md,
    },
    tab: { flex: 1, paddingVertical: space.sm, borderRadius: radius.md, alignItems: 'center' },
    activeTab: { backgroundColor: GOLD_TINT },
    tabText: { fontWeight: weight.heavy, fontSize: font.caption },

    activeCard: {
        borderRadius: radius.xl, marginBottom: space.md,
        borderWidth: 1, overflow: 'hidden',
    },
    activeHeader: {
        flexDirection: 'row', justifyContent: 'space-between', padding: space.md,
        borderBottomWidth: 1, alignItems: 'center',
    },
    liveBadge: {
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
        backgroundColor: withAlpha(SUCCESS, ALPHA.medium),
        paddingHorizontal: space.xs, paddingVertical: space.xxs, borderRadius: radius.sm,
    },
    pulsingDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: SUCCESS },
    liveText: { fontSize: font.micro, fontWeight: weight.heavy, color: SUCCESS },
    dateText: { fontSize: font.caption, fontWeight: weight.semibold },
    activeContent: { padding: space.lg },
    activeTitle: { ...text.title, marginBottom: space.xs },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
    locationText: { fontWeight: weight.semibold },
    actionBar: {
        padding: space.md, flexDirection: 'row',
        justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1,
    },
    actionLeft: { gap: 2, flex: 1, marginRight: space.xs },
    nextTaskLabel: { fontSize: font.micro, fontWeight: weight.heavy },
    nextTaskValue: { fontSize: font.caption, fontWeight: weight.semibold },
    actionBarBtns: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
    toolBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: SUCCESS,
        paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, gap: space.xxs,
    },
    toolBtnText: { color: '#FFFFFF', fontWeight: weight.heavy, fontSize: font.micro },
    enterBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: GOLD,
        paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, gap: space.xxs,
    },
    enterText: { color: '#0A0F1A', fontWeight: weight.heavy, fontSize: font.caption },

    reviewSnippet: { marginTop: space.sm, gap: space.xxs },
    reviewSnippetText: { fontSize: font.caption, fontWeight: weight.semibold, fontStyle: 'italic' },

    ticketCard: {
        flexDirection: 'row', borderRadius: radius.lg, marginBottom: space.sm,
        overflow: 'hidden', borderWidth: 1,
    },
    statusStrip: { width: 6, height: '100%' },
    ticketContent: { flex: 1, padding: space.md },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.md },
    ticketTitle: { ...text.body, fontWeight: weight.heavy, flex: 1, marginRight: space.sm },
    pendingTag: {
        ...tint(WARNING),
        paddingHorizontal: space.xs, paddingVertical: space.xxs, borderRadius: radius.xs,
    },
    pendingTagText: { fontSize: font.micro, fontWeight: weight.heavy, color: WARNING },
    ticketInfo: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    ticketLabel: { fontSize: font.micro, fontWeight: weight.heavy, marginBottom: 2 },
    ticketValue: { fontSize: font.footnote, fontWeight: weight.semibold },
    verticalLine: { width: 1, height: 24 },
});

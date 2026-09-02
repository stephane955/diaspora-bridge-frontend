import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ImageBackground, ScrollView, Pressable, ListRenderItem, StatusBar, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import ScreenLoader from '@/components/ScreenLoader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import { mediumFeedback } from '@/utils/haptics';
import { clientMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors, type PremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    GOLD,
    GOLD_DEEP,
    ICON_BUTTON_SIZE,
    INFO,
    INFO_SOFT,
    NAVY,
    SCREEN_H_PADDING,
    SUCCESS,
    SUCCESS_DEEP,
    WARNING,
    icon as iconSize,
    radius,
    shadow,
    space,
    text,
    tint,
    withAlpha,
} from '@/constants/design';

import ProjectStories from '@/components/ProjectStories';
import { normalizeProjectStatus, projectStatusProgress } from '@/utils/projectStatus';
import { fetchUserAvailableBalanceMinor } from '@/lib/ledgerBalance';
import { P00_BALANCE_UNAVAILABLE } from '@/constants/p00Security';

/** Text that always sits on a dark image or gradient, in both themes. */
const ON_DARK_PRIMARY = '#FFFFFF';
const ON_DARK_SECONDARY = withAlpha('#FFFFFF', 0.7);

export default function DiasporaDashboard() {
    const router = useRouter();
    const { session } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const [projects, setProjects] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    // --- 1. Data Fetching ---
    const fetchData = useCallback(async (opts?: { background?: boolean }) => {
        if (!session?.user) return;
        if (opts?.background) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            // A. Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', session.user.id)
                .single();
            if (profileData) setProfile(profileData);

            // B. Projects
            const { data: projData } = await supabase
                .from('projects')
                .select('id, title, city, status, image_url, created_at')
                .eq('owner_id', session.user.id)
                .order('created_at', { ascending: false });
            if (projData) setProjects(projData);

            const balanceMinor = await fetchUserAvailableBalanceMinor();
            setBalance(balanceMinor === null ? null : Number(balanceMinor));
            setActivities([]);

        } catch (e) {
            console.error("Dashboard Load Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [session]);

    useFocusEffect(
        useCallback(() => {
            fetchData({ background: true });
        }, [fetchData])
    );

    useEffect(() => {
        const unsubscribe = navigation.addListener(
            // Tab navigators emit tabPress; typed EventMap may omit it for this screen.
            'tabPress' as Parameters<typeof navigation.addListener>[0],
            () => {
                fetchData({ background: true });
            },
        );
        return unsubscribe;
    }, [navigation, fetchData]);

    useEffect(() => {
        const channel = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData({ background: true }))
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session, fetchData]);

    // --- 2. Render Components ---
    const activeCount = projects.filter(p => normalizeProjectStatus(p.status) === 'in_progress').length;
    const completedCount = projects.filter(p => normalizeProjectStatus(p.status) === 'completed').length;

    const renderProjectCard: ListRenderItem<any> = ({ item }) => {
        const status = normalizeProjectStatus(item.status);
        const progress = projectStatusProgress(item.status);
        const needsReview = status === 'in_progress';
        const statusLabel = status === 'completed' ? 'COMPLETED' : status === 'in_progress' ? 'ACTIVE' : 'PENDING';
        const statusColor = status === 'completed' ? SUCCESS : status === 'in_progress' ? SUCCESS : WARNING;
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.projectCard,
                    { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                ]}
                onPress={() => router.push(`/diaspora/project/${item.id}`)}
            >
                <ImageBackground
                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                    style={styles.projectImage}
                    imageStyle={{ borderRadius: radius.xl }}
                >
                    <LinearGradient colors={['transparent', withAlpha(NAVY, 0.95)]} style={styles.cardOverlay}>
                        <View style={styles.cardTopRow}>
                            <View style={styles.statusPill}>
                                <View style={[styles.activeDot, { backgroundColor: statusColor }]} />
                                <Text style={styles.statusText}>{statusLabel}</Text>
                            </View>
                            {needsReview && (
                                <View style={styles.notifPill}>
                                    <Text style={styles.notifPillText}>Review Proof</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.cardBottom}>
                            <View style={styles.progressBarWrap}>
                                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                            </View>
                            <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
                            <View style={styles.locRow}>
                                <Ionicons name="location" size={iconSize.xs} color={ON_DARK_SECONDARY} />
                                <Text style={styles.projectLoc}>{item.city}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </Pressable>
        );
    };

    if (loading) {
        return <ScreenLoader />;
    }

    return (
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
            <PremiumHeader
                title={profile?.full_name?.split(' ')[0] || t('tabHome') || 'Home'}
                subtitle={t('buildingDreams')}
                onNotificationsPress={() => router.push('/notifications')}
                menuItems={clientMenuItems(router, t)}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={offsets.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchData({ background: true })}
                        tintColor={GOLD}
                    />
                }
            >

                {/* --- HERO SECTION --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab' }}
                    style={styles.heroContainer}
                >
                    <LinearGradient
                        colors={[withAlpha(NAVY, 0.9), withAlpha(NAVY, 0.6), withAlpha(NAVY, 0.4)]}
                        style={styles.heroGradient}
                    >
                        <View style={styles.balanceSection}>
                            <Text style={styles.balanceLabel}>TOTAL SECURED ESCROW</Text>
                            <Text style={styles.balanceAmount}>
                                {balance === null ? P00_BALANCE_UNAVAILABLE : `${balance.toLocaleString()} CFA`}
                            </Text>
                            <View style={styles.secureBadge}>
                                <Ionicons name="shield-checkmark" size={iconSize.xs} color={SUCCESS} />
                                <Text style={styles.secureText}>{t('securedBy') || "Secured by Stripe"}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                {/* --- FLOATING STATS CARD --- */}
                <View style={styles.floatingCardWrap}>
                    <BlurView intensity={60} tint={c.blurTint} style={styles.floatingStatsCard}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{activeCount}</Text>
                            <Text style={styles.statLabel}>Active Projects</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{completedCount}</Text>
                            <Text style={styles.statLabel}>Completed</Text>
                        </View>
                    </BlurView>
                </View>

                {/* --- QUICK ACTIONS (Colorful) --- */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/diaspora/new'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[GOLD, GOLD_DEEP]} style={styles.quickActionIconColor}>
                            <Ionicons name="add" size={iconSize.md} color={ON_DARK_PRIMARY} />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>New Project</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/diaspora/wallet'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[SUCCESS, SUCCESS_DEEP]} style={styles.quickActionIconColor}>
                            <Ionicons name="wallet" size={iconSize.md} color={ON_DARK_PRIMARY} />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>Deposit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/diaspora/projects'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[INFO, INFO_SOFT]} style={styles.quickActionIconColor}>
                            <Ionicons name="person-add" size={iconSize.md} color={ON_DARK_PRIMARY} />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>Hire Expert</Text>
                    </TouchableOpacity>
                </View>

                {/* --- CONTENT BODY --- */}
                <View style={styles.bodyContent}>

                    {/* Stories (Updates) */}
                    <ProjectStories />

                    {/* My Projects */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('myJobsTab')}</Text>
                        <TouchableOpacity onPress={() => router.push('/diaspora/projects')}>
                            <Text style={styles.seeAll}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {projects.length === 0 ? (
                        <PremiumEmptyState
                            icon="construct-outline"
                            title={t('noActiveJobs')}
                            subtitle={t('postProjectSub')}
                            actionLabel={t('tabPostJob')}
                            onAction={() => router.push('/diaspora/new')}
                        />
                    ) : (
                        <FlatList
                            data={projects}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={item => item.id}
                            style={{ marginHorizontal: -offsets.horizontal }}
                            contentContainerStyle={{ paddingHorizontal: offsets.horizontal }}
                            renderItem={renderProjectCard}
                        />
                    )}

                    {/* Recent Activity (Dynamic) */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                    </View>

                    {activities.length === 0 ? (
                        <PremiumEmptyState
                            icon="pulse-outline"
                            title="No recent activity."
                            subtitle="Deposits, escrow releases and payouts appear here."
                        />
                    ) : (
                        activities.map((act, index) => (
                            <View key={index} style={styles.feedItem}>
                                <View style={[styles.feedIcon, { backgroundColor: withAlpha(act.amount > 0 ? SUCCESS : INFO, ALPHA.medium) }]}>
                                    <Ionicons
                                        name={act.amount > 0 ? "arrow-down" : "arrow-up"}
                                        size={iconSize.sm}
                                        color={act.amount > 0 ? SUCCESS : INFO}
                                    />
                                </View>
                                <View>
                                    <Text style={styles.feedText}>{act.description || "Transaction"}</Text>
                                    <Text style={styles.feedTime}>
                                        {new Date(act.created_at).toLocaleDateString()} • {Number(act.amount).toLocaleString()} CFA
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (c: PremiumColors) => StyleSheet.create({
    container: { flex: 1 },

    // --- HERO ---
    // No explicit width: the negative margin cancels the page gutter so the
    // hero bleeds edge to edge on both sides.
    heroContainer: { height: 340, marginHorizontal: -SCREEN_H_PADDING, overflow: 'hidden' },
    heroGradient: { flex: 1, paddingHorizontal: SCREEN_H_PADDING, justifyContent: 'space-between', paddingBottom: space.xl },

    balanceSection: { marginBottom: 0 },
    balanceLabel: { ...text.label, color: ON_DARK_SECONDARY, letterSpacing: 1 },
    balanceAmount: { ...text.hero, color: ON_DARK_PRIMARY, marginTop: space.xxs },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        marginTop: space.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: space.sm,
        paddingVertical: space.xxs,
        borderRadius: radius.pill,
        ...tint(SUCCESS),
    },
    secureText: { ...text.caption, color: SUCCESS },

    // --- FLOATING STATS CARD ---
    floatingCardWrap: { marginTop: -40 },
    floatingStatsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.xl,
        padding: space.lg,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
        ...shadow.card,
    },
    statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statValue: { ...text.title, color: c.textPrimary, letterSpacing: -0.5 },
    statLabel: { ...text.micro, color: c.textSecondary, marginTop: space.xxs },
    statDivider: { width: 1, height: '60%', backgroundColor: c.border },

    // --- QUICK ACTIONS ---
    quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: space.xl, paddingBottom: space.xs },
    quickActionBtn: { alignItems: 'center', gap: space.xs },
    quickActionIconColor: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', ...shadow.card },
    quickActionLabel: { ...text.caption, color: c.textPrimary, letterSpacing: -0.5 },

    bodyContent: { paddingTop: space.xs },

    // --- SECTIONS ---
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.md },
    sectionTitle: { ...text.subtitle, color: c.textPrimary, letterSpacing: -0.5 },
    seeAll: { ...text.footnote, color: GOLD },

    // --- PROJECT CARD ---
    projectCard: { width: 280, height: 200, marginRight: space.md, borderRadius: radius.xl, ...shadow.card },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: radius.xl },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: space.lg },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        borderRadius: radius.sm,
    },
    activeDot: { width: 6, height: 6, borderRadius: radius.xs, marginRight: space.xs },
    statusText: { ...text.micro, color: c.textPrimary, fontWeight: '800' },
    notifPill: { backgroundColor: GOLD, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm },
    notifPillText: { ...text.micro, color: '#0A0F1A', fontWeight: '800' },
    progressBarWrap: {
        height: 4,
        backgroundColor: withAlpha('#FFFFFF', ALPHA.strong),
        borderRadius: radius.xs,
        marginBottom: space.sm,
        overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: GOLD, borderRadius: radius.xs },
    cardBottom: {},
    projectTitle: { ...text.subtitle, color: ON_DARK_PRIMARY, marginBottom: space.xxs, letterSpacing: -0.5 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
    projectLoc: { ...text.caption, color: ON_DARK_SECONDARY },

    // --- FEED ---
    feedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        padding: space.md,
        borderRadius: radius.lg,
        marginBottom: space.sm,
        borderWidth: 1,
        borderColor: c.border,
        ...shadow.card,
    },
    feedIcon: {
        width: ICON_BUTTON_SIZE,
        height: ICON_BUTTON_SIZE,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: space.md,
    },
    feedText: { ...text.footnote, color: c.textPrimary, fontWeight: '800' },
    feedTime: { ...text.caption, color: c.textSecondary, marginTop: 2 },
});

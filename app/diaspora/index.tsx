import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ImageBackground, ScrollView, Pressable, ListRenderItem, StatusBar, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG } from '@/constants/layout';
import PulseLoader from '@/components/PulseLoader';
import { mediumFeedback } from '@/utils/haptics';
import { clientMenuItems } from '@/constants/premiumMenus';

import ProjectStories from '@/components/ProjectStories';

export default function DiasporaDashboard() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { session } = useAuth();
    const { t } = useLanguage();

    const [projects, setProjects] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
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

            // C. Balance (Sum of Transactions)
            const { data: txData } = await supabase
                .from('transactions')
                .select('amount, description, created_at, type')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (txData) {
                const total = txData.reduce((acc, curr) => acc + Number(curr.amount), 0);
                setBalance(total);
                setActivities(txData.slice(0, 3)); // Top 3 recent activities
            }

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
        const unsubscribe = navigation.addListener('tabPress', () => {
            fetchData({ background: true });
        });
        return unsubscribe;
    }, [navigation, fetchData]);

    useEffect(() => {
        const channel = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData({ background: true }))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData({ background: true }))
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session, fetchData]);

    // --- 2. Render Components ---
    const activeCount = projects.filter(p => p.status === 'in_progress').length;
    const pendingApprovals = projects.filter(p => p.status !== 'in_progress').length;

    const renderProjectCard: ListRenderItem<any> = ({ item }) => {
        const progress = item.status === 'in_progress' ? 0.65 : 0.3;
        const needsReview = item.status === 'in_progress';
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
                    imageStyle={{ borderRadius: 24 }}
                >
                    <LinearGradient colors={['transparent', 'rgba(15, 23, 42, 0.95)']} style={styles.cardOverlay}>
                        <View style={styles.cardTopRow}>
                            <View style={styles.statusPill}>
                                <View style={[styles.activeDot, { backgroundColor: item.status === 'in_progress' ? '#16A34A' : '#F59E0B' }]} />
                                <Text style={styles.statusText}>
                                    {item.status === 'in_progress' ? "ACTIVE" : "PENDING"}
                                </Text>
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
                                <Ionicons name="location" size={12} color="#94A3B8" />
                                <Text style={styles.projectLoc}>{item.city}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </Pressable>
        );
    };

    if (loading) {
        return <View style={styles.center}><PulseLoader /></View>;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={profile?.full_name?.split(' ')[0] || t('tabHome') || 'Home'}
                subtitle={t('buildingDreams')}
                onNotificationsPress={() => router.push('/diaspora/inbox')}
                menuItems={clientMenuItems(router, t)}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32, paddingHorizontal: theme.spacing.lg }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchData({ background: true })}
                        tintColor={theme.colors.active}
                    />
                }
            >

                {/* --- HERO SECTION --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab' }}
                    style={styles.heroContainer}
                >
                    <LinearGradient
                        colors={['rgba(15, 23, 42, 0.9)', 'rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.4)']}
                        style={styles.heroGradient}
                    >
                        <View style={styles.balanceSection}>
                            <Text style={styles.balanceLabel}>TOTAL SECURED ESCROW</Text>
                            <Text style={styles.balanceAmount}>{balance.toLocaleString()} CFA</Text>
                            <View style={styles.secureBadge}>
                                <Ionicons name="shield-checkmark" size={12} color="#16A34A" />
                                <Text style={styles.secureText}>{t('securedBy') || "Secured by Stripe"}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                {/* --- FLOATING STATS CARD --- */}
                <View style={styles.floatingCardWrap}>
                    <BlurView intensity={60} tint="light" style={styles.floatingStatsCard}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{activeCount}</Text>
                            <Text style={styles.statLabel}>Active Projects</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{pendingApprovals}</Text>
                            <Text style={styles.statLabel}>Pending Approvals</Text>
                        </View>
                    </BlurView>
                </View>

                {/* --- QUICK ACTIONS (Colorful) --- */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/diaspora/new'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[theme.colors.active, theme.colors.activeSoft]} style={styles.quickActionIconColor}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>New Project</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/diaspora/wallet'); }} activeOpacity={0.7}>
                        <LinearGradient colors={[theme.colors.emerald, theme.colors.emeraldSoft]} style={styles.quickActionIconColor}>
                            <Ionicons name="wallet" size={22} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.quickActionLabel}>Deposit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => { mediumFeedback(); router.push('/diaspora/projects'); }} activeOpacity={0.7}>
                        <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.quickActionIconColor}>
                            <Ionicons name="person-add" size={22} color="#fff" />
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
                        <View style={styles.emptyBox}>
                            <Ionicons name="construct-outline" size={40} color="#CBD5E1" />
                            <Text style={styles.emptyText}>{t('noActiveJobs')}</Text>
                            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/diaspora/new')}>
                                <Text style={styles.createBtnText}>{t('tabPostJob')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={projects}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ paddingHorizontal: 20 }}
                            renderItem={renderProjectCard}
                        />
                    )}

                    {/* Recent Activity (Dynamic) */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                    </View>

                    {activities.length === 0 ? (
                        <Text style={{ marginLeft: 20, color: '#94A3B8' }}>No recent activity.</Text>
                    ) : (
                        activities.map((act, index) => (
                            <View key={index} style={styles.feedItem}>
                                <View style={[styles.feedIcon, { backgroundColor: act.amount > 0 ? '#F0FDF4' : '#F0F9FF' }]}>
                                    <Ionicons
                                        name={act.amount > 0 ? "arrow-down" : "arrow-up"}
                                        size={18}
                                        color={act.amount > 0 ? "#16A34A" : "#0EA5E9"}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // --- HERO ---
    heroContainer: { width: '100%', height: 340, marginHorizontal: -theme.spacing.lg, borderRadius: 0, overflow: 'hidden' },
    heroGradient: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 28 },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
    heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
    helloText: { fontSize: 13, color: theme.colors.textSubtle, fontWeight: '600', marginBottom: 2, letterSpacing: -0.5 },
    userName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    headerActions: { flexDirection: 'row', gap: 10 },
    glassIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    redDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger, borderWidth: 1, borderColor: theme.colors.surface },

    balanceSection: { marginBottom: 0 },
    balanceLabel: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
    secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: theme.colors.success + '26', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.success + '40' },
    secureText: { color: theme.colors.success, fontSize: 12, fontWeight: '700' },

    // --- FLOATING STATS CARD ---
    floatingCardWrap: { marginTop: -40, paddingHorizontal: 20 },
    floatingStatsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: theme.radii.xl,
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.glass,
        overflow: 'hidden',
        ...theme.shadow.soft,
    },
    statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '700' },
    statDivider: { width: 1, height: '60%', backgroundColor: theme.colors.border },

    // --- QUICK ACTIONS ---
    quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
    quickActionBtn: { alignItems: 'center', gap: 8 },
    quickActionIconColor: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...theme.shadow.glow },
    quickActionLabel: { fontSize: 12, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },

    bodyContent: { paddingTop: 8 },

    // --- SECTIONS ---
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
    seeAll: { color: theme.colors.active, fontWeight: '700', fontSize: 14 },

    // --- PROJECT CARD ---
    projectCard: { width: 280, height: 200, marginRight: theme.spacing.md, borderRadius: theme.radii.xl, ...theme.shadow.soft },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: theme.radii.xl },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: 20 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.sm },
    activeDot: { width: 6, height: 6, borderRadius: 3, marginRight: theme.spacing.xs },
    statusText: { color: theme.colors.text, fontSize: 10, fontWeight: '800' },
    notifPill: { backgroundColor: theme.colors.active, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.sm },
    notifPillText: { color: theme.colors.surface, fontSize: 11, fontWeight: '800' },
    progressBarWrap: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: theme.colors.active, borderRadius: 2 },
    cardBottom: {},
    projectTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    projectLoc: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

    // --- EMPTY STATES & FEEDS ---
    emptyBox: { padding: theme.spacing.xxl, alignItems: 'center', backgroundColor: theme.colors.surface, marginHorizontal: theme.spacing.lg, borderRadius: theme.radii.xl, borderStyle: 'dashed', borderWidth: 2, borderColor: theme.colors.border, gap: theme.spacing.sm },
    emptyText: { fontWeight: '600', color: theme.colors.textSubtle, fontSize: 15 },
    createBtn: { backgroundColor: theme.colors.activeSoft + '20', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.sm },
    createBtnText: { color: theme.colors.active, fontWeight: '700' },

    feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: theme.spacing.md, marginHorizontal: theme.spacing.lg, borderRadius: theme.radii.lg, marginBottom: theme.spacing.sm, ...theme.shadow.soft, borderWidth: 1, borderColor: theme.colors.border },
    feedIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    feedText: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
    feedTime: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },

    // --- MODAL ---
    modalOverlay: { flex: 1, backgroundColor: theme.colors.glassDark, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: theme.colors.surface, padding: theme.spacing.xl, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: theme.spacing.md },
    modalTitle: { fontSize: 22, ...theme.typography.title, color: theme.colors.text, marginBottom: 4 },
    modalSection: { fontSize: 11, ...theme.typography.label, color: theme.colors.textSubtle, marginTop: theme.spacing.md, marginBottom: 4 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 12 },
    modalIconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    modalText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    modalSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: 4 },
});
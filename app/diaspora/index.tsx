import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ImageBackground, ScrollView, Pressable, ListRenderItem, Modal, StatusBar, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

// --- COMPONENTS ---
import ProjectStories from '@/components/ProjectStories';

export default function DiasporaDashboard() {
    const router = useRouter();
    const { session, signOut } = useAuth();
    const { t } = useLanguage();

    const [projects, setProjects] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [profile, setProfile] = useState<any>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // --- 1. Data Fetching ---
    const fetchData = useCallback(async () => {
        if (!session?.user) return;
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
        }
    }, [session]);

    useEffect(() => {
        fetchData();

        // Realtime Subscription
        const channel = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
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
        return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

                {/* --- HERO SECTION --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab' }}
                    style={styles.heroContainer}
                >
                    <LinearGradient
                        colors={['rgba(15, 23, 42, 0.9)', 'rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.4)']}
                        style={styles.heroGradient}
                    >
                        <SafeAreaView edges={['top']} style={styles.topBar}>
                            <View style={styles.heroTitleRow}>
                                <TouchableOpacity onPress={() => setMenuOpen(true)}>
                                    <Image
                                        source={{ uri: profile?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=client' }}
                                        style={styles.avatar}
                                    />
                                </TouchableOpacity>
                                <View>
                                    <Text style={styles.helloText}>{t('welcomeBack')}</Text>
                                    <Text style={styles.userName}>
                                        {profile?.full_name?.split(' ')[0] || "Client"}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.headerActions}>
                                <TouchableOpacity style={styles.glassIconBtn} onPress={() => router.push('/notifications')}>
                                    <Ionicons name="notifications" size={20} color="#fff" />
                                    <View style={styles.redDot} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.glassIconBtn} onPress={() => setMenuOpen(true)}>
                                    <Ionicons name="menu" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>

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

                {/* --- QUICK ACTIONS --- */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/diaspora/new')}>
                        <View style={styles.quickActionIcon}>
                            <Ionicons name="add" size={24} color="#0F172A" />
                        </View>
                        <Text style={styles.quickActionLabel}>New Project</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/diaspora/wallet')}>
                        <View style={styles.quickActionIcon}>
                            <Ionicons name="wallet" size={22} color="#0F172A" />
                        </View>
                        <Text style={styles.quickActionLabel}>Deposit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/diaspora/projects')}>
                        <View style={styles.quickActionIcon}>
                            <Ionicons name="person-add" size={22} color="#0F172A" />
                        </View>
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

            {/* Menu Modal */}
            <Modal visible={menuOpen} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>{t('accountMenuTitle')}</Text>

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/diaspora/profile'); }}>
                            <View style={styles.modalIconBox}><Ionicons name="person-outline" size={20} color="#0F172A" /></View>
                            <Text style={styles.modalText}>{t('tabProfile')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/diaspora/wallet'); }}>
                            <View style={styles.modalIconBox}><Ionicons name="wallet-outline" size={20} color="#0F172A" /></View>
                            <Text style={styles.modalText}>My Wallet</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity
                            style={styles.modalItem}
                            onPress={async () => { setMenuOpen(false); await signOut(); router.replace('/login'); }}
                        >
                            <View style={[styles.modalIconBox, {backgroundColor: '#FEF2F2'}]}>
                                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                            </View>
                            <Text style={[styles.modalText, {color: '#EF4444'}]}>{t('signOut')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // --- HERO ---
    heroContainer: { width: '100%', height: 340 },
    heroGradient: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 28 },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
    heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
    helloText: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginBottom: 2, letterSpacing: -0.5 },
    userName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    headerActions: { flexDirection: 'row', gap: 10 },
    glassIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    redDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#fff' },

    balanceSection: { marginBottom: 0 },
    balanceLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
    secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(22, 163, 74, 0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(22, 163, 74, 0.25)' },
    secureText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },

    // --- FLOATING STATS CARD ---
    floatingCardWrap: { marginTop: -40, paddingHorizontal: 20 },
    floatingStatsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
    },
    statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '700' },
    statDivider: { width: 1, height: '60%', backgroundColor: '#E2E8F0' },

    // --- QUICK ACTIONS ---
    quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
    quickActionBtn: { alignItems: 'center', gap: 8 },
    quickActionIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    quickActionLabel: { fontSize: 12, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },

    bodyContent: { paddingTop: 8 },

    // --- SECTIONS ---
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    seeAll: { color: '#0EA5E9', fontWeight: '700', fontSize: 14 },

    // --- PROJECT CARD ---
    projectCard: { width: 280, height: 200, marginRight: 16, borderRadius: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 6 },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 24 },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: 20 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    activeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusText: { color: '#0F172A', fontSize: 10, fontWeight: '800' },
    notifPill: { backgroundColor: '#0EA5E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    notifPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    progressBarWrap: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#0EA5E9', borderRadius: 2 },
    cardBottom: {},
    projectTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    projectLoc: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

    // --- EMPTY STATES & FEEDS ---
    emptyBox: { padding: 40, alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0', gap: 10 },
    emptyText: { fontWeight: '600', color: '#94A3B8', fontSize: 15 },
    createBtn: { backgroundColor: '#F0F9FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
    createBtnText: { color: '#0EA5E9', fontWeight: '700' },

    feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 20, borderRadius: 20, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, borderWidth: 1, borderColor: '#F1F5F9' },
    feedIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    feedText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
    feedTime: { color: '#64748B', fontSize: 12, marginTop: 2, fontWeight: '500' },

    // --- MODAL ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, gap: 12 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    modalIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    modalText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
});
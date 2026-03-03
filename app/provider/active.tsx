import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';

export default function ActiveSites() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage(); // <--- Hook for translations

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'active' | 'applied'>('active');
    const [projects, setProjects] = useState<any[]>([]);       // Active Jobs
    const [applications, setApplications] = useState<any[]>([]); // Bids
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- FETCH DATA ---
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Fetch ACTIVE Contracts (Where you are the assigned provider)
            const { data: activeData } = await supabase
                .from('projects')
                .select('*')
                .eq('assigned_provider_id', user.id)
                .in('status', ['in_progress', 'In Progress'])
                .order('updated_at', { ascending: false });

            // 2. Fetch APPLIED Jobs (Where you sent a bid)
            const { data: appliedData } = await supabase
                .from('project_applications')
                .select('*, projects(title, city, budget, status)')
                .eq('provider_id', user.id)
                .eq('status', 'pending');

            if (activeData) setProjects(activeData);
            if (appliedData) setApplications(appliedData);

        } catch (error) {
            console.error("Error fetching jobs:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- RENDER: ACTIVE JOB CARD (Command Center Style) ---
    const renderActive = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.activeCard}
            activeOpacity={0.95}
            // IMPORTANT: Links to the Workroom (project/[id])
            onPress={() => router.push(`/provider/project/${item.id}`)}
        >
            <View style={styles.activeHeader}>
                <View style={styles.liveBadge}>
                    <View style={styles.pulsingDot} />
                    <Text style={styles.liveText}>{t('liveSite') || "LIVE SITE"}</Text>
                </View>
                <Text style={styles.dateText}>
                    {t('started') || "Started"} {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>

            <View style={styles.activeContent}>
                <Text style={styles.activeTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={16} color="#64748B" />
                    <Text style={styles.locationText}>{item.city}</Text>
                </View>
            </View>

            {/* Action Bar */}
            <View style={styles.actionBar}>
                <View style={styles.actionLeft}>
                    <Text style={styles.nextTaskLabel}>{t('nextTask') || "NEXT TASK"}</Text>
                    <Text style={styles.nextTaskValue}>{t('uploadProof') || "Upload Milestone Proof"}</Text>
                </View>
                <View style={styles.enterBtn}>
                    <Text style={styles.enterText}>{t('open') || "Open"}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
            </View>
        </TouchableOpacity>
    );

    // --- RENDER: APPLIED JOB CARD (Ticket Style) ---
    const renderApplied = ({ item }: { item: any }) => (
        <View style={styles.ticketCard}>
            {/* Left Side: Status Color Strip */}
            <View style={[styles.statusStrip, { backgroundColor: '#F59E0B' }]} />

            <View style={styles.ticketContent}>
                <View style={styles.ticketHeader}>
                    <Text style={styles.ticketTitle}>{item.projects?.title || 'Unknown Project'}</Text>
                    <View style={styles.pendingTag}>
                        <Text style={styles.pendingTagText}>{t('pending') || "PENDING"}</Text>
                    </View>
                </View>

                <View style={styles.ticketInfo}>
                    <View>
                        <Text style={styles.ticketLabel}>{t('clientBudget') || "CLIENT BUDGET"}</Text>
                        <Text style={styles.ticketValue}>
                            {item.projects?.budget ? item.projects.budget.toLocaleString() : 'N/A'} CFA
                        </Text>
                    </View>
                    <View style={styles.verticalLine} />
                    <View>
                        <Text style={styles.ticketLabel}>{t('yourBid') || "YOUR BID"}</Text>
                        <Text style={[styles.ticketValue, { color: theme.colors.text }]}>
                            {item.bid_amount?.toLocaleString()} CFA
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {/* --- NEW HEADER --- */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('sitesTitle') || "My Sites"}</Text>

                {/* Integrated Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                        onPress={() => setActiveTab('active')}
                    >
                        <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                            {t('clientDashboard.activeProjects') || "Active"} ({projects.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'applied' && styles.activeTab]}
                        onPress={() => setActiveTab('applied')}
                    >
                        <Text style={[styles.tabText, activeTab === 'applied' && styles.activeTabText]}>
                            {t('applicantsTitle') || "Applied"} ({applications.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* CONTENT LIST */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.text} /></View>
            ) : (
                <FlatList
                    data={activeTab === 'active' ? projects : applications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={activeTab === 'active' ? renderActive : renderApplied}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name={activeTab === 'active' ? "hammer-outline" : "document-text-outline"} size={48} color={theme.colors.textSubtle} />
                            <Text style={styles.emptyTitle}>
                                {activeTab === 'active' ? (t('noActiveJobs') || "No Active Sites") : "No Applications"}
                            </Text>
                            <Text style={styles.emptySub}>
                                {activeTab === 'active'
                                    ? (t('clientDashboard.noProjects') || "Once you are hired, your projects will appear here.")
                                    : "Check the market for new opportunities."}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        paddingTop: 70,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
        backgroundColor: theme.colors.surface,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 10
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: theme.colors.text,
        marginBottom: theme.spacing.lg,
        letterSpacing: -1
    },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        padding: 4,
        gap: 4
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    activeTab: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },
    tabText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 13
    },
    activeTabText: {
        color: '#0F172A'
    },

    listContent: { padding: 20, paddingBottom: 100 },

    // --- ACTIVE CARD STYLES ---
    activeCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },

    activeHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
    liveText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
    dateText: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },

    activeContent: { padding: 20 },
    activeTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { color: '#64748B', fontWeight: '500' },

    actionBar: { backgroundColor: '#F8FAFC', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    actionLeft: { gap: 2 },
    nextTaskLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
    nextTaskValue: { fontSize: 13, fontWeight: '600', color: '#334155' },
    enterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
    enterText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    // --- TICKET (APPLIED) CARD STYLES ---
    ticketCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
    statusStrip: { width: 6, height: '100%' },
    ticketContent: { flex: 1, padding: 16 },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    ticketTitle: { fontSize: 16, fontWeight: '700', color: '#334155', flex: 1, marginRight: 10 },
    pendingTag: { backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FEF3C7' },
    pendingTagText: { fontSize: 10, fontWeight: '800', color: '#D97706' },

    ticketInfo: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    ticketLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginBottom: 2 },
    ticketValue: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    verticalLine: { width: 1, height: 24, backgroundColor: '#E2E8F0' },

    // EMPTY STATE
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 16 },
    emptySub: { textAlign: 'center', color: '#64748B', marginTop: 8, lineHeight: 22 },
});
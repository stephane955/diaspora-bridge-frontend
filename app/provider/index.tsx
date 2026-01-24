import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    RefreshControl, StatusBar, Alert, Modal, ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ProviderDashboard() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();

    const [activeJobs, setActiveJobs] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [myCity, setMyCity] = useState('');
    const [filterCity, setFilterCity] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'jobs' | 'requests'>('jobs');
    const [profileName, setProfileName] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setRefreshing(true);

        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, city')
                .eq('id', user.id)
                .maybeSingle();

            const meta = user.user_metadata as any;
            const cityValue = profile?.city || meta?.city || t('unknownLocation');
            setProfileName(profile?.full_name || meta?.full_name || t('providerFallback'));
            setMyCity(cityValue);

            const { data: hiddenData } = await supabase
                .from('hidden_projects')
                .select('project_id')
                .eq('provider_id', user.id);

            const hiddenIds = (hiddenData || []).map((row: any) => row.project_id);

            const { data: active } = await supabase
                .from('projects')
                .select('*')
                .eq('assigned_provider_id', user.id)
                .in('status', ['in_progress', 'In Progress', 'active', 'Active']);

            if (active) setActiveJobs(active);

            let query = supabase
                .from('projects')
                .select('*')
                .in('status', ['pending', 'Pending']);

            if (filterCity && cityValue) {
                query = query.ilike('city', cityValue);
            }

            const { data: pending } = await query.order('created_at', { ascending: false });
            if (pending) {
                const filtered = pending.filter((item: any) => !hiddenIds.includes(item.id));
                setLeads(filtered);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    }, [filterCity, myCity, t, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleHideRequest = async (projectId: number) => {
        if (!user) return;
        const { error } = await supabase
            .from('hidden_projects')
            .insert({ provider_id: user.id, project_id: projectId });

        if (error) {
            Alert.alert(t('errorTitle') || "Error", error.message);
            return;
        }
        setLeads(prev => prev.filter(item => item.id !== projectId));
    };

    const handleSignOut = async () => {
        await signOut();
        router.replace('/login');
    };

    const handleDeleteAccount = () => {
        if (!user) return;
        Alert.alert(
            t('deleteAccountTitle') || "Delete Account",
            t('deleteAccountConfirm') || "This action is permanent.",
            [
                { text: t('cancel') || "Cancel", style: 'cancel' },
                {
                    text: t('delete') || "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
                            if (error) throw error;
                            await signOut();
                            router.replace('/login');
                        } catch (err: any) {
                            Alert.alert("Error", err.message);
                        }
                    }
                }
            ]
        );
    };

    const listData = activeTab === 'jobs' ? activeJobs : leads;
    const emptyText = activeTab === 'jobs' ? t('noActiveJobs') : t('noRequests');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <FlatList
                data={listData}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 150 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#0F172A" />}
                ListHeaderComponent={
                    <View style={{ marginBottom: 20 }}>
                        {/* --- HERO SECTION --- */}
                        <ImageBackground
                            source={{ uri: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop' }}
                            style={styles.heroContainer}
                        >
                            <LinearGradient
                                colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.8)', '#F8FAFC']}
                                style={styles.heroGradient}
                            >
                                {/* Top Bar */}
                                <View style={styles.topBar}>
                                    <View style={styles.topBarLeft}>
                                        <Image source={{ uri: 'https://i.pravatar.cc/150?u=pro' }} style={styles.avatarSmall} />
                                        <Text style={styles.topBarTitle}>{t('providerDashboardTitle')}</Text>
                                    </View>
                                    <View style={styles.headerActions}>
                                        <TouchableOpacity style={styles.glassIconBtn} onPress={() => { setRefreshing(true); fetchData(); }}>
                                            <Ionicons name="refresh" size={20} color="#fff" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.glassIconBtn} onPress={() => setMenuOpen(true)}>
                                            <Ionicons name="menu" size={22} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Welcome Info */}
                                <View style={styles.welcomeSection}>
                                    <Text style={styles.welcomeLabel}>{t('welcomeBack')}</Text>
                                    <Text style={styles.userName}>{profileName}</Text>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location" size={14} color="#38BDF8" />
                                        <Text style={styles.cityText}>{myCity}</Text>
                                    </View>
                                </View>

                                {/* Glass Stats */}
                                <BlurView intensity={30} tint="light" style={styles.glassStats}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{activeJobs.length}</Text>
                                        <Text style={styles.statLabel}>Active</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{leads.length}</Text>
                                        <Text style={styles.statLabel}>Requests</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>4.9</Text>
                                        <Text style={styles.statLabel}>Rating</Text>
                                    </View>
                                </BlurView>
                            </LinearGradient>
                        </ImageBackground>

                        {/* --- TABS --- */}
                        <View style={styles.tabsContainer}>
                            <View style={styles.tabsRow}>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'jobs' && styles.tabActive]}
                                    onPress={() => setActiveTab('jobs')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>{t('myJobsTab')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
                                    onPress={() => setActiveTab('requests')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>{t('requestsTab')}</Text>
                                    {leads.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{leads.length}</Text></View>}
                                </TouchableOpacity>
                            </View>

                            {/* Filter (Only for Requests) */}
                            {activeTab === 'requests' && (
                                <TouchableOpacity onPress={() => setFilterCity(!filterCity)} style={styles.filterRow}>
                                    <Ionicons name={filterCity ? "checkbox" : "square-outline"} size={20} color="#0F172A" />
                                    <Text style={styles.filterText}>
                                        {filterCity ? `Only showing jobs in ${myCity}` : t('allCities')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>{emptyText}</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    activeTab === 'jobs' ? (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => router.push(`/provider/job/${item.id}`)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>ACTIVE</Text>
                                </View>
                            </View>
                            <Text style={styles.cardSub}>{item.city} • {item.budget?.toLocaleString()} CFA</Text>

                            <View style={styles.cardFooter}>
                                <View style={styles.providerRow}>
                                    <Ionicons name="construct" size={16} color="#64748B" />
                                    <Text style={styles.providerText}>In Progress</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.card}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/provider/job/${item.id}`)}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: '#F0F9FF' }]}>
                                        <Text style={[styles.statusText, { color: '#0EA5E9' }]}>NEW</Text>
                                    </View>
                                </View>
                                <Text style={styles.cardSub}>{item.city} • {item.budget?.toLocaleString()} CFA</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.refuseBtn} onPress={() => handleHideRequest(item.id)}>
                                <Text style={styles.refuseText}>{t('notInterested')}</Text>
                            </TouchableOpacity>
                        </View>
                    )
                )}
            />

            {/* SETTINGS MENU MODAL */}
            <Modal visible={menuOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>{t('accountMenuTitle')}</Text>

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/provider/profile'); }}>
                            <View style={styles.modalIconBox}><Ionicons name="settings-outline" size={20} color="#0F172A" /></View>
                            <Text style={styles.modalText}>{t('accountSettings')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/modal'); }}>
                            <View style={styles.modalIconBox}><Ionicons name="help-circle-outline" size={20} color="#0F172A" /></View>
                            <Text style={styles.modalText}>{t('support')}</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); handleSignOut(); }}>
                            <View style={[styles.modalIconBox, { backgroundColor: '#FEF2F2' }]}><Ionicons name="log-out-outline" size={20} color="#EF4444" /></View>
                            <Text style={[styles.modalText, { color: '#EF4444' }]}>{t('signOut')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); handleDeleteAccount(); }}>
                            <View style={[styles.modalIconBox, { backgroundColor: '#FEF2F2' }]}><Ionicons name="trash-outline" size={20} color="#EF4444" /></View>
                            <Text style={[styles.modalText, { color: '#EF4444' }]}>{t('deleteAccountAction') || "Delete Account"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalClose} onPress={() => setMenuOpen(false)}>
                            <Text style={styles.modalCloseText}>{t('close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // --- HERO HEADER ---
    heroContainer: { width: '100%', height: 340 },
    heroGradient: { flex: 1, paddingTop: 60, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 30 },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarSmall: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' },
    topBarTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

    headerActions: { flexDirection: 'row', gap: 8 },
    glassIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

    welcomeSection: { marginBottom: 20 },
    welcomeLabel: { fontSize: 16, color: '#CBD5E1', fontWeight: '600', marginBottom: 4 },
    userName: { fontSize: 32, color: '#fff', fontWeight: '800', letterSpacing: -0.5 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    cityText: { fontSize: 14, color: '#E2E8F0', fontWeight: '600' },

    glassStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
    statLabel: { fontSize: 11, color: '#CBD5E1', textTransform: 'uppercase', marginTop: 2, fontWeight: '600' },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 5 },

    // --- TABS & FILTERS ---
    tabsContainer: { paddingHorizontal: 20, marginTop: -20 },
    tabsRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
    tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
    tabActive: { backgroundColor: '#0F172A' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#fff' },
    badge: { backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8, paddingLeft: 4 },
    filterText: { color: '#0F172A', fontWeight: '600' },

    // --- CARDS ---
    emptyBox: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#94A3B8', fontSize: 16 },

    card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 10 },
    statusBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },

    cardSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 12 },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    providerText: { fontSize: 13, color: '#64748B', fontWeight: '500' },

    refuseBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#FEF2F2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    refuseText: { color: '#EF4444', fontWeight: '700', fontSize: 12 },

    // --- MODAL ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    modalIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    modalText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
    modalClose: { alignItems: 'center', paddingTop: 10, marginTop: 10 },
    modalCloseText: { color: '#94A3B8', fontWeight: '700' }
});
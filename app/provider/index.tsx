import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    RefreshControl, StatusBar, Alert, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

            const cityValue = profile?.city || user.user_metadata?.city || t('unknownLocation');
            setProfileName(profile?.full_name || user.user_metadata?.full_name || t('providerFallback'));
            setMyCity(cityValue);

            const { data: hiddenData } = await supabase
                .from('hidden_projects')
                .select('project_id')
                .eq('user_id', user.id);

            const hiddenIds = (hiddenData || []).map((row: any) => row.project_id);

            const { data: active } = await supabase
                .from('projects')
                .select('*')
                .eq('provider_id', user.id)
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
            .insert({ user_id: user.id, project_id: projectId });

        if (error) {
            Alert.alert(t('errorTitle'), error.message);
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
            t('deleteAccountConfirm') || "This action is permanent. Your profile and related data will be deleted. Are you sure?",
            [
                { text: t('cancel') || "Cancel", style: 'cancel' },
                {
                    text: t('delete') || t('deleteAction') || "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
                            if (error) throw error;
                            await signOut();
                            router.replace('/login');
                        } catch (err: any) {
                            Alert.alert(t('errorTitle') || "Error", err.message || "Failed to delete account");
                        }
                    }
                }
            ]
        );
    };

    const listData = activeTab === 'jobs' ? activeJobs : leads;
    const emptyText = activeTab === 'jobs'
        ? t('noActiveJobs')
        : t('noRequests');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('providerDashboardTitle')}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => { setRefreshing(true); fetchData(); }}>
                        <Ionicons name="refresh" size={20} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/provider/profile')}>
                        <Ionicons name="person-circle" size={22} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
                        <Ionicons name="menu" size={22} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={listData}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
                ListHeaderComponent={
                    <View style={styles.listHeader}>
                        <View style={styles.profileRow}>
                            <View>
                                <Text style={styles.welcomeLabel}>{t('welcomeBack')}</Text>
                                <Text style={styles.userName}>{profileName}</Text>
                                <Text style={styles.cityText}>{myCity}</Text>
                            </View>
                            <Image source={{ uri: 'https://i.pravatar.cc/150?u=pro' }} style={styles.profileImg} />
                        </View>

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
                            </TouchableOpacity>
                        </View>

                        {activeTab === 'requests' && (
                            <View style={styles.filterRow}>
                                <TouchableOpacity onPress={() => setFilterCity(!filterCity)} style={styles.filterPill}>
                                    <Ionicons name="filter" size={12} color={filterCity ? '#fff' : '#0F172A'} />
                                    <Text style={[styles.filterText, filterCity && { color: '#fff' }]}>
                                        {filterCity ? `${t('inCity')} ${myCity}` : t('allCities')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
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
                            onPress={() => router.push(`/provider/project/${item.id}`)}
                        >
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardSub}>{item.city} • {item.budget?.toLocaleString()} CFA</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardStatus}>{t('inProgressStatus')}</Text>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.card}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/provider/project/${item.id}`)}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardSub}>{item.city} • {item.budget?.toLocaleString()} CFA</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.refuseBtn} onPress={() => handleHideRequest(item.id)}>
                                <Text style={styles.refuseText}>{t('notInterested')}</Text>
                            </TouchableOpacity>
                        </View>
                    )
                )}
            />

            <Modal visible={menuOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{t('accountMenuTitle')}</Text>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/provider/profile'); }}>
                            <Ionicons name="settings" size={18} color="#0F172A" />
                            <Text style={styles.modalText}>{t('accountSettings')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/modal'); }}>
                            <Ionicons name="help-circle" size={18} color="#0F172A" />
                            <Text style={styles.modalText}>{t('support')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalItem, styles.modalDanger]} onPress={() => { setMenuOpen(false); handleSignOut(); }}>
                            <Ionicons name="log-out" size={18} color="#EF4444" />
                            <Text style={styles.modalDangerText}>{t('signOut')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalItem, styles.modalDanger]} onPress={() => { setMenuOpen(false); handleDeleteAccount(); }}>
                            <Ionicons name="trash" size={18} color="#EF4444" />
                            <Text style={styles.modalDangerText}>{t('deleteAccountAction') || "Delete Account"}</Text>
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
    header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    headerActions: { flexDirection: 'row', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    listHeader: { padding: 20, paddingTop: 16 },
    profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    welcomeLabel: { fontSize: 14, color: '#64748B' },
    userName: { fontSize: 22, color: '#0F172A', fontWeight: '800' },
    cityText: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
    profileImg: { width: 44, height: 44, borderRadius: 22 },

    tabsRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 16, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    tabActive: { backgroundColor: '#0F172A' },
    tabText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    tabTextActive: { color: '#fff' },

    filterRow: { marginTop: 16, alignItems: 'flex-start' },
    filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    filterText: { fontSize: 12, fontWeight: '600', color: '#fff' },

    emptyBox: { alignItems: 'center', marginTop: 20 },
    emptyText: { color: '#94A3B8' },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    cardSub: { fontSize: 12, color: '#64748B', marginTop: 4 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    cardStatus: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
    refuseBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2' },
    refuseText: { color: '#EF4444', fontWeight: '700', fontSize: 11 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    modalText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    modalDanger: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
    modalDangerText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
    modalClose: { alignItems: 'center', paddingTop: 4 },
    modalCloseText: { color: '#64748B', fontWeight: '700' }
});

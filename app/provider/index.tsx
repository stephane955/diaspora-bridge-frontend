import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    RefreshControl, StatusBar, ImageBackground, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function ProviderDashboard() {
    const router = useRouter();
    const { user } = useAuth();

    const [activeJobs, setActiveJobs] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [myCity, setMyCity] = useState('');
    const [filterCity, setFilterCity] = useState(true);
    const [earnings, setEarnings] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setRefreshing(true);

        try {
            // 1. Get User City
            const { data: userData } = await supabase.auth.getUser();
            const city = userData.user?.user_metadata?.city || '';
            setMyCity(city || 'Unknown Location');

            // 2. Get Active Jobs
            const { data: active } = await supabase
                .from('projects')
                .select('*')
                .eq('provider_id', user.id)
                .neq('status', 'Completed')
                .neq('status', 'Pending');

            if (active) setActiveJobs(active);

            // 3. Get New Leads (Case Insensitive Search)
            let query = supabase
                .from('projects')
                .select('*')
                .eq('status', 'Pending');

            if (filterCity && city) {
                query = query.ilike('city', city); // Matches "Douala" with "douala"
            }

            const { data: pending } = await query.order('created_at', { ascending: false });
            if (pending) setLeads(pending);

            // 4. Calculate Earnings
            const { data: expenses } = await supabase
                .from('project_expenses')
                .select('amount')
                .eq('provider_id', user.id)
                .eq('status', 'approved');

            const total = expenses?.reduce((sum, item) => sum + item.amount, 0) || 0;
            setEarnings(total);

        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    }, [user, filterCity]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- HAMBURGER MENU / SIGN OUT LOGIC ---
    const openMenu = () => {
        Alert.alert(
            "Account Menu",
            "Choose an option",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        await supabase.auth.signOut();
                        router.replace('/login');
                    }
                }
            ]
        );
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* --- TOP BAR --- */}
            <View style={styles.topBar}>
                <View>
                    <Text style={styles.appName}>Provider Dashboard</Text>
                    <Text style={styles.appSub}>Professional Control</Text>
                </View>
                <View style={styles.topIcons}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => { setRefreshing(true); fetchData(); }}>
                        <Ionicons name="refresh" size={20} color="#0F172A" />
                    </TouchableOpacity>

                    {/* HAMBURGER BUTTON */}
                    <TouchableOpacity style={styles.iconBtn} onPress={openMenu}>
                        <Ionicons name="menu" size={24} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Welcome & Profile */}
            <View style={styles.profileRow}>
                <View>
                    <Text style={styles.welcomeLabel}>Welcome back,</Text>
                    <Text style={styles.userName}>{user?.user_metadata?.full_name || 'Provider'}</Text>
                </View>
                <Image source={{ uri: 'https://i.pravatar.cc/150?u=pro' }} style={styles.profileImg} />
            </View>

            {/* Earnings Card */}
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.portfolioCard}>
                <View style={[styles.glowBlob, { backgroundColor: '#0EA5E9', top: -50, right: -50 }]} />
                <View>
                    <Text style={styles.cardLabel}>Available Balance</Text>
                    <Text style={styles.cardAmount}>{earnings.toLocaleString()} CFA</Text>
                </View>
                <View style={styles.cardFooter}>
                    <TouchableOpacity onPress={() => router.push('/provider/earnings')} style={styles.tag}>
                        <Ionicons name="wallet" size={12} color="#4ADE80" />
                        <Text style={styles.tagText}>Open Wallet</Text>
                    </TouchableOpacity>
                    <Text style={styles.cardDate}>Updated just now</Text>
                </View>
            </LinearGradient>

            {/* Active Sites Section */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Active Sites</Text>
                <TouchableOpacity onPress={() => router.push('/provider/active')}>
                    <Text style={styles.seeAll}>Manage All</Text>
                </TouchableOpacity>
            </View>

            {activeJobs.length === 0 ? (
                <View style={styles.emptyBoxHorizontal}>
                    <Text style={styles.emptyText}>No active jobs.</Text>
                </View>
            ) : (
                <FlatList
                    horizontal
                    data={activeJobs}
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ gap: 15 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.projectCard} onPress={() => router.push('/provider/active')}>
                            <ImageBackground
                                source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                                style={styles.projectImage}
                                imageStyle={{ borderRadius: 20 }}
                            >
                                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay}>
                                    <View style={styles.statusPill}>
                                        <View style={styles.activeDot} />
                                        <Text style={styles.statusText}>Active</Text>
                                    </View>
                                    <Text style={styles.projectTitle}>{item.title}</Text>
                                </LinearGradient>
                            </ImageBackground>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Leads Filter */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New Opportunities</Text>
                <TouchableOpacity onPress={() => setFilterCity(!filterCity)} style={styles.filterPill}>
                    <Ionicons name="filter" size={12} color={filterCity ? '#fff' : '#0F172A'} />
                    <Text style={[styles.filterText, filterCity && { color: '#fff' }]}>
                        {filterCity ? `In ${myCity}` : 'All Cities'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <FlatList
                data={leads}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListHeaderComponent={renderHeader}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No jobs found in {filterCity ? myCity : 'any city'}.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.feedItem} onPress={() => router.push(`/provider/job/${item.id}`)}>
                        <View style={styles.feedIcon}>
                            <Ionicons name="search" size={20} color="#0EA5E9" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.feedText}>{item.title}</Text>
                            <Text style={styles.feedSub}>{item.city} • {item.budget?.toLocaleString()} CFA</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerContainer: { padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    appName: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    appSub: { fontSize: 12, color: '#64748B' },
    topIcons: { flexDirection: 'row', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    welcomeLabel: { fontSize: 14, color: '#64748B' },
    userName: { fontSize: 24, color: '#0F172A', fontWeight: '800' },
    profileImg: { width: 44, height: 44, borderRadius: 22 },

    portfolioCard: { width: '100%', height: 160, borderRadius: 24, padding: 24, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
    glowBlob: { position: 'absolute', width: 100, height: 100, borderRadius: 50, opacity: 0.4 },
    cardLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
    cardAmount: { color: '#fff', fontSize: 32, fontWeight: '800' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardDate: { color: '#64748B', fontSize: 12 },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    tagText: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    seeAll: { color: '#0EA5E9', fontWeight: '600', fontSize: 14 },

    filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    filterText: { fontSize: 12, fontWeight: '600', color: '#fff' },

    emptyBoxHorizontal: { padding: 20, backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center' },
    projectCard: { width: 200, height: 140, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: 12, borderRadius: 20 },
    statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backdropFilter: 'blur(10px)' },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginRight: 6 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    projectTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

    feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 10, marginHorizontal: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 5 },
    feedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    feedText: { color: '#0F172A', fontSize: 15, fontWeight: '600' },
    feedSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
    emptyBox: { alignItems: 'center', marginTop: 20 },
    emptyText: { color: '#94A3B8' }
});
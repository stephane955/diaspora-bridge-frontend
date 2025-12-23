import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    ActivityIndicator, RefreshControl, Image, ImageBackground
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { mediumFeedback } from '@/utils/haptics';

export default function ActiveSites() {
    const router = useRouter();
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchActiveProjects = useCallback(async () => {
        if (!user) return;

        // Fetch projects where I am the provider AND status is 'In Progress'
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('provider_id', user.id)
            .eq('status', 'In Progress')
            .order('updated_at', { ascending: false });

        if (data) setProjects(data);
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    useEffect(() => { fetchActiveProjects(); }, [fetchActiveProjects]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchActiveProjects();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Active Contracts</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    data={projects}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486744.png' }} style={styles.emptyImg} />
                            <Text style={styles.emptyTitle}>No Active Contracts</Text>
                            <Text style={styles.emptySub}>Apply for jobs in the "New Jobs" tab. Once a client hires you, the project will appear here.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            activeOpacity={0.95}
                            onPress={() => router.push(`/diaspora/project/${item.id}`)}
                        >
                            <ImageBackground
                                source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                                style={styles.cardImage}
                                imageStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
                            >
                                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.imageOverlay}>
                                    <View style={styles.statusBadge}>
                                        <View style={styles.statusDot} />
                                        <Text style={styles.statusText}>Live Site</Text>
                                    </View>
                                    <Text style={styles.projectTitle}>{item.title}</Text>
                                    <Text style={styles.projectCity}>
                                        <Ionicons name="location" size={14} color="#CBD5E1" /> {item.city}
                                    </Text>
                                </LinearGradient>
                            </ImageBackground>

                            <View style={styles.cardBody}>
                                <View style={styles.statsRow}>
                                    <View>
                                        <Text style={styles.statLabel}>Budget</Text>
                                        <Text style={styles.statValue}>{item.budget?.toLocaleString()} CFA</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View>
                                        <Text style={styles.statLabel}>Client</Text>
                                        <Text style={styles.statValue}>Verified</Text>
                                    </View>
                                </View>

                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.btn, styles.updateBtn]}
                                        onPress={() => {
                                            mediumFeedback();
                                            router.push(`/provider/post_update?projectId=${item.id}`);
                                        }}
                                    >
                                        <Ionicons name="camera" size={18} color="#fff" />
                                        <Text style={styles.btnText}>Post Update</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.btn, styles.payBtn]}
                                        onPress={() => {
                                            mediumFeedback();
                                            router.push(`/provider/request-payout?projectId=${item.id}`);
                                        }}
                                    >
                                        <Ionicons name="cash-outline" size={18} color="#0F172A" />
                                        <Text style={[styles.btnText, { color: '#0F172A' }]}>Request Pay</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
    backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#F1F5F9' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

    listContent: { padding: 20, paddingBottom: 100 },

    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyImg: { width: 100, height: 100, opacity: 0.5, marginBottom: 20 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    emptySub: { textAlign: 'center', color: '#64748B', marginTop: 8, lineHeight: 22 },

    card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    cardImage: { width: '100%', height: 160 },
    imageOverlay: { flex: 1, justifyContent: 'flex-end', padding: 16 },

    statusBadge: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginRight: 6 },
    statusText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },

    projectTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
    projectCity: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },

    cardBody: { padding: 16 },
    statsRow: { flexDirection: 'row', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    divider: { width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 20 },
    statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    statValue: { fontSize: 16, color: '#0F172A', fontWeight: '700' },

    actionRow: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
    updateBtn: { backgroundColor: '#0F172A' },
    payBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    btnText: { color: '#fff', fontSize: 13, fontWeight: '700' }
});
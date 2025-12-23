import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase'; //
import { useAuth } from '@/context/AuthContext'; //
import { mediumFeedback } from '@/utils/haptics'; //

export default function ActiveProjects() {
    const router = useRouter();
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchActiveProjects = useCallback(async () => {
        if (!user) return;

        // Fetch projects assigned to THIS provider
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('provider_id', user.id)
            .neq('status', 'Pending') // We want 'In Progress' or 'Completed'
            .order('updated_at', { ascending: false });

        if (data) setProjects(data);
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    useEffect(() => {
        fetchActiveProjects();
    }, [fetchActiveProjects]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchActiveProjects();
    };

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Active Sites</Text>
            <Text style={styles.emptySub}>
                Go to the "Chat" tab to find and accept new job requests.
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.centerContent}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    data={projects}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={projects.length === 0 ? styles.centerContent : styles.listContent}
                    ListEmptyComponent={EmptyState}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            {/* Header: Project & Status */}
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={styles.projectTitle}>{item.title}</Text>
                                    <View style={styles.metaRow}>
                                        <View style={styles.metaItem}>
                                            <Ionicons name="location-sharp" size={12} color="#888" />
                                            <Text style={styles.metaText}>{item.city}</Text>
                                        </View>
                                        <View style={[styles.metaItem, { marginLeft: 12 }]}>
                                            <Ionicons name="cash-outline" size={12} color="#888" />
                                            <Text style={styles.metaText}>{item.budget?.toLocaleString()} CFA</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Status Badge */}
                                <View style={[styles.badge, styles.badgeActive]}>
                                    <Text style={[styles.badgeText, styles.textActive]}>
                                        {item.status}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Footer: Action */}
                            <View style={styles.cardFooter}>
                                <View style={styles.clientSection}>
                                    <View style={styles.avatarCircle}>
                                        <Text style={styles.avatarText}>C</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.label}>Client</Text>
                                        <Text style={styles.clientName}>View Details</Text>
                                    </View>
                                </View>

                                {/* Pass the project ID so we know which one to update */}
                                <TouchableOpacity
                                    style={styles.uploadBtn}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        mediumFeedback();
                                        // We pass the project ID as a parameter
                                        router.push(`/provider/post_update?projectId=${item.id}`);
                                    }}
                                >
                                    <Ionicons name="camera" size={20} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={styles.btnText}>Post Update</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    listContent: { padding: 20, paddingBottom: 100 },
    centerContent: { flex: 1, justifyContent: 'center', padding: 20 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#334155', marginTop: 15 },
    emptySub: { textAlign: 'center', color: '#94A3B8', marginTop: 8, lineHeight: 22 },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    projectTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 6 },

    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: '#64748B', fontSize: 13 },

    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeActive: { backgroundColor: '#F0FDF4' },
    badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    textActive: { color: '#16A34A' },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    clientSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
    label: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' },
    clientName: { fontSize: 14, fontWeight: '600', color: '#334155' },

    uploadBtn: { backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 30 },
    btnText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
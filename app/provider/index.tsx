import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, FlatList } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import AvailableProjectCard from '@/components/AvailableProjectCard';
import ProviderNavigation from '@/components/ProviderNavigation';
import { mediumFeedback } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function ProviderDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const [myJobs, setMyJobs] = useState<any[]>([]);
    const [availableProjects, setAvailableProjects] = useState<any[]>([]);
    const [stats, setStats] = useState({ earned: 0, pending: 0 });

    const fetchData = useCallback(async () => {
        if (!user) return;
        const [jobsRes, marketRes, expenseRes] = await Promise.all([
            supabase.from('projects').select('*').eq('provider_id', user.id),
            supabase.from('projects').select('*').is('provider_id', null).eq('status', 'pending_assignment').limit(5),
            supabase.from('project_expenses').select('amount, status').in('project_id',
                (await supabase.from('projects').select('id').eq('provider_id', user.id)).data?.map(p => p.id) || []
            )
        ]);

        if (jobsRes.data) setMyJobs(jobsRes.data);
        if (marketRes.data) setAvailableProjects(marketRes.data);

        const earned = expenseRes.data?.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0) || 0;
        const pending = expenseRes.data?.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0) || 0;
        setStats({ earned, pending });
    }, [user]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    return (
        <View style={styles.container}>
            <NavigationBar title="Work Hub" subtitle="Manage your builds" showBack={false} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 140 }}
            >
                {/* REFINED FINTECH CARD */}
                <View style={styles.fintechCard}>
                    <Text style={styles.cardLabel}>AVAILABLE TO WITHDRAW</Text>
                    <Text style={styles.cardAmount}>{stats.earned.toLocaleString()} <Text style={styles.currency}>CFA</Text></Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                            <Text style={styles.statLabel}>Pending: {stats.pending.toLocaleString()} CFA</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.primaryAction}
                        onPress={() => { mediumFeedback(); router.push('/provider/earnings'); }}
                    >
                        <Text style={styles.primaryActionText}>Finance Center</Text>
                        <Ionicons name="wallet-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* MESSAGES SECTION */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Active Chats</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, marginBottom: 10 }}>
                    {myJobs.map(job => (
                        <TouchableOpacity key={job.id} style={styles.chatCircle} onPress={() => router.push(`/chat/${job.id}`)}>
                            <Image source={{ uri: job.image_url }} style={styles.chatAvatar} />
                            <View style={styles.onlineIndicator} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* ACTIVE JOBS */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Sites</Text>
                    <Text style={styles.badge}>{myJobs.length}</Text>
                </View>
                <FlatList
                    horizontal
                    data={myJobs}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingLeft: 20 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.glassJobCard}
                            onPress={() => router.push(`/diaspora/project/${item.id}`)}
                        >
                            <Image source={{ uri: item.image_url }} style={styles.jobCover} />
                            <BlurView intensity={90} tint="dark" style={styles.jobOverlay}>
                                <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.jobSub}>{item.city}</Text>
                            </BlurView>
                        </TouchableOpacity>
                    )}
                />

                {/* MARKETPLACE: HIGH CONTRAST */}
                <View style={[styles.sectionHeader, { marginTop: 30 }]}>
                    <Text style={styles.sectionTitle}>Available Work</Text>
                </View>
                <View style={{ paddingHorizontal: 20 }}>
                    {availableProjects.map(item => (
                        <View key={item.id} style={styles.marketWrapper}>
                            <AvailableProjectCard
                                project={item}
                                onAccept={() => { mediumFeedback(); fetchData(); }}
                            />
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* THE FIX: Labelled Navigation ensures you know what you're clicking */}
            <ProviderNavigation />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    fintechCard: { margin: 20, padding: 25, backgroundColor: '#0F172A', borderRadius: 32, elevation: 8 },
    cardLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    cardAmount: { color: '#fff', fontSize: 32, fontWeight: '900', marginVertical: 10 },
    currency: { fontSize: 16, color: '#38BDF8' },
    statsRow: { flexDirection: 'row', marginBottom: 20 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    statLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
    primaryAction: { backgroundColor: '#38BDF8', padding: 16, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    primaryActionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 15, gap: 10 },
    sectionTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', color: '#64748B', fontWeight: '800' },
    chatCircle: { marginRight: 15, width: 64, height: 64 },
    chatAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#38BDF8' },
    onlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },
    glassJobCard: { width: width * 0.75, height: 190, marginRight: 15, borderRadius: 30, overflow: 'hidden' },
    jobCover: { width: '100%', height: '100%' },
    jobOverlay: { position: 'absolute', bottom: 0, width: '100%', padding: 20 },
    jobTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    jobSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
    marketWrapper: { marginBottom: 20 }
});
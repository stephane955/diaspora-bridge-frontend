import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Image, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '@/types/models';
import ProviderNavigation from '@/components/ProviderNavigation';

export default function RequestsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [hiddenJobs, setHiddenJobs] = useState<string[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const loadHidden = async () => {
            const saved = await AsyncStorage.getItem('hidden_jobs');
            if (saved) setHiddenJobs(JSON.parse(saved));
        };
        loadHidden();
    }, []);

    // 1. Fetch REAL projects
    const fetchRequests = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // FIX: Removed <Project> generic from .from()
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .is('provider_id', null)
            .eq('status', 'Pending')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        if (data) {
            const filtered = data.filter(item => !hiddenJobs.includes(item.id.toString()));
            // FIX: Cast data to Project[] here
            setRequests(filtered as Project[]);
        }
        setLoading(false);
        setRefreshing(false);
    }, [user, hiddenJobs]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    // 2. Handle "Accept Project"
    const handleAccept = async (projectId: string) => {
        mediumFeedback();
        setProcessingId(projectId);

        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    provider_id: user?.id,
                    status: 'In Progress'
                })
                .eq('id', projectId);

            if (error) throw error;

            successFeedback();
            Alert.alert("Success", "Project accepted! check your 'Active Contracts'.");

            setRequests(prev => prev.filter(r => r.id !== projectId));
            router.push('/provider/active');

        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const hideJob = async (projectId: string) => {
        const next = Array.from(new Set([...hiddenJobs, projectId.toString()]));
        setHiddenJobs(next);
        await AsyncStorage.setItem('hidden_jobs', JSON.stringify(next));
        setRequests(prev => prev.filter(r => r.id.toString() !== projectId.toString()));
    };

    const renderItem = ({ item }: { item: Project }) => (
        <View style={styles.ticketContainer}>
            {/* LEFT SIDE: Project Details */}
            <View style={styles.ticketMain}>
                <View style={styles.ticketHeader}>
                    <View style={styles.tagContainer}>
                        <Ionicons name="flash" size={10} color="#D97706" />
                        <Text style={styles.urgencyText}>NEW LEAD</Text>
                    </View>
                    <Text style={styles.timeAgo}>Just now</Text>
                </View>

                <Text style={styles.budget}>
                    {item.budget ? item.budget.toLocaleString() : '0'} <Text style={styles.currency}>CFA</Text>
                </Text>
                <Text style={styles.projectTitle} numberOfLines={2}>{item.title}</Text>

                <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="#64748B" />
                    <Text style={styles.locationTitle}>{item.city}</Text>
                </View>
            </View>

            {/* SEPARATOR (Perforated Line) */}
            <View style={styles.separator}>
                <View style={styles.circleTop} />
                <View style={styles.line} />
                <View style={styles.circleBottom} />
            </View>

            {/* RIGHT SIDE: Actions */}
            <View style={styles.ticketActions}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.clientAvatar} />
                ) : (
                    <View style={styles.clientAvatarFallback}>
                        <Text style={styles.avatarText}>{item.title.charAt(0)}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.acceptBtn, processingId === item.id && { opacity: 0.7 }]}
                    activeOpacity={0.8}
                    onPress={() => handleAccept(item.id)}
                    disabled={!!processingId}
                >
                    {processingId === item.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.acceptText}>ACCEPT</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.declineBtn} onPress={() => hideJob(item.id)}>
                    <Text style={styles.declineText}>Ignore</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* --- PREMIUM HEADER --- */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
                    <Text style={styles.headerTitle}>New Opportunities</Text>
                    <Text style={styles.headerSub}>You have <Text style={{color: '#0EA5E9', fontWeight:'800'}}>{requests.length}</Text> new leads waiting.</Text>
                </View>
                <TouchableOpacity style={styles.filterBtn}>
                    <Ionicons name="options-outline" size={22} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486744.png' }} style={styles.emptyImg} />
                            <Text style={styles.emptyTitle}>All Caught Up!</Text>
                            <Text style={styles.emptySub}>There are no new jobs matching your profile right now. Check back later.</Text>
                        </View>
                    }
                />
            )}

            <ProviderNavigation />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header Styles
    header: { paddingTop: 70, paddingHorizontal: 24, paddingBottom: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerDate: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4, letterSpacing: 1 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', lineHeight: 32 },
    headerSub: { fontSize: 14, color: '#64748B', marginTop: 4 },
    filterBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginTop: 10 },

    listContent: { padding: 20, paddingBottom: 100 },

    // Ticket Styles
    ticketContainer: { flexDirection: 'row', height: 170, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    ticketMain: { flex: 2, backgroundColor: '#fff', borderTopLeftRadius: 20, borderBottomLeftRadius: 20, padding: 16, justifyContent: 'space-between' },

    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tagContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    urgencyText: { color: '#D97706', fontSize: 10, fontWeight: '800' },
    timeAgo: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

    budget: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    currency: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    projectTitle: { fontSize: 15, fontWeight: '600', color: '#334155', marginTop: -4, lineHeight: 22 },

    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locationTitle: { fontSize: 13, fontWeight: '600', color: '#64748B' },

    // Separator
    separator: { width: 20, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    line: { width: 1, height: '70%', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
    circleTop: { position: 'absolute', top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F8FAFC' },
    circleBottom: { position: 'absolute', bottom: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F8FAFC' },

    // Right Side
    ticketActions: { flex: 1, backgroundColor: '#fff', borderTopRightRadius: 20, borderBottomRightRadius: 20, padding: 12, alignItems: 'center', justifyContent: 'center' },

    clientAvatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 10, borderWidth: 2, borderColor: '#F1F5F9' },
    clientAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    avatarText: { color: '#64748B', fontWeight: '700', fontSize: 18 },

    acceptBtn: { backgroundColor: '#0F172A', width: '100%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
    acceptText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    declineBtn: { paddingVertical: 8 },
    declineText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },

    // Empty State
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyImg: { width: 80, height: 80, opacity: 0.5, marginBottom: 20 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    emptySub: { textAlign: 'center', color: '#64748B', marginTop: 8, lineHeight: 22 },
});
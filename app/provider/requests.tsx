import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; //
import { useAuth } from '@/context/AuthContext'; //
import { mediumFeedback, successFeedback } from '@/utils/haptics'; //
import { useRouter } from 'expo-router';

export default function RequestsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 1. Fetch REAL projects that are waiting for a provider
    const fetchRequests = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // Get projects that have NO provider yet (pending)
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .is('provider_id', null)
            .eq('status', 'Pending') // Ensure your DB uses 'Pending' or 'pending_assignment'
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        if (data) setRequests(data);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // 2. Handle "Accept Project"
    const handleAccept = async (projectId: string) => {
        mediumFeedback();
        setProcessingId(projectId);

        try {
            // Assign the project to THIS provider
            const { error } = await supabase
                .from('projects')
                .update({
                    provider_id: user?.id,
                    status: 'In Progress' // Updates status to active
                })
                .eq('id', projectId);

            if (error) throw error;

            successFeedback();
            Alert.alert("Success", "Project accepted! It is now in your Active Sites.");

            // Remove from list immediately
            setRequests(prev => prev.filter(r => r.id !== projectId));

            // Navigate to Active Sites
            router.push('/provider/active');

        } catch (err: any) {
            Alert.alert("Error", "Could not accept project.");
        } finally {
            setProcessingId(null);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.ticketContainer}>
            {/* LEFT SIDE: Project Details */}
            <View style={styles.ticketMain}>
                <View style={styles.ticketHeader}>
                    <View style={styles.tagContainer}>
                        <Ionicons name="time" size={12} color="#D32F2F" />
                        <Text style={styles.urgencyText}>New Request</Text>
                    </View>
                </View>

                {/* Real Budget from DB */}
                <Text style={styles.budget}>
                    {item.budget ? item.budget.toLocaleString() : '0'} <Text style={{fontSize: 14, color: '#2E7D32'}}>CFA</Text>
                </Text>
                <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>

                <View style={styles.locationRow}>
                    <View style={styles.iconBox}>
                        <Ionicons name="location" size={14} color="#555" />
                    </View>
                    <View>
                        <Text style={styles.locationTitle}>{item.city}</Text>
                        <Text style={styles.distance}>Remote Job</Text>
                    </View>
                </View>
            </View>

            {/* SEPARATOR */}
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

                <Text style={styles.clientName}>Client</Text>

                <TouchableOpacity
                    style={[styles.acceptBtn, processingId === item.id && { opacity: 0.5 }]}
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

                <TouchableOpacity style={styles.declineBtn} onPress={() => Alert.alert("Hidden", "Project removed from your feed.")}>
                    <Text style={styles.declineText}>Hide</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>New Opportunities ({requests.length})</Text>
            {loading ? (
                <View style={{ marginTop: 50 }}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={{ color: '#94A3B8' }}>No new jobs available right now.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8', padding: 20 },
    pageTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
    ticketContainer: { flexDirection: 'row', height: 190, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    ticketMain: { flex: 2, backgroundColor: '#fff', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, padding: 16, justifyContent: 'space-between' },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tagContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    urgencyText: { color: '#D32F2F', fontSize: 10, fontWeight: '700' },
    budget: { fontSize: 26, fontWeight: '900', color: '#2E7D32', letterSpacing: -0.5 },
    projectTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: -5 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    locationTitle: { fontSize: 12, fontWeight: '700', color: '#333' },
    distance: { fontSize: 11, color: '#888' },
    separator: { width: 20, backgroundColor: '#f4f6f8', alignItems: 'center', justifyContent: 'center' },
    line: { width: 1, height: '80%', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },
    circleTop: { position: 'absolute', top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f4f6f8' },
    circleBottom: { position: 'absolute', bottom: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f4f6f8' },
    ticketActions: { flex: 1, backgroundColor: '#fff', borderTopRightRadius: 16, borderBottomRightRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#f0f0f0' },
    clientAvatar: { width: 40, height: 40, borderRadius: 20, marginBottom: 8 },
    clientAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    clientName: { fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'center' },
    acceptBtn: { backgroundColor: '#000', width: '100%', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
    acceptText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    declineBtn: { width: '100%', paddingVertical: 6, alignItems: 'center' },
    declineText: { color: '#999', fontSize: 11, fontWeight: '600' }
});
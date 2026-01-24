import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function AdminVerifyScreen() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        setLoading(true);
        // Get profiles that are pending, including their ID doc link from the 'verifications' table
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                id, full_name, city, verification_status,
                verifications ( document_url )
            `)
            .eq('verification_status', 'pending');

        if (data) setRequests(data);
        setLoading(false);
    };

    useEffect(() => { fetchPending(); }, []);

    const handleAction = async (userId: string, action: 'verified' | 'rejected') => {
        const { error } = await supabase
            .from('profiles')
            .update({
                verification_status: action,
                is_verified: action === 'verified'
            })
            .eq('id', userId);

        if (!error) {
            Alert.alert("Success", `User ${action}`);
            setRequests(prev => prev.filter(r => r.id !== userId));
        }
    };

    const renderRequest = ({ item }: { item: any }) => {
        // Since the bucket is private, we'd normally need a signed URL.
        // For simplicity in the dashboard, you can view the path.
        const docPath = item.verifications?.[0]?.document_url;

        return (
            <View style={styles.card}>
                <Text style={styles.name}>{item.full_name}</Text>
                <Text style={styles.sub}>{item.city}</Text>

                <Text style={styles.pathLabel}>Document Path: {docPath}</Text>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.rejectBtn]}
                        onPress={() => handleAction(item.id, 'rejected')}
                    >
                        <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.approveBtn]}
                        onPress={() => handleAction(item.id, 'verified')}
                    >
                        <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Pending Verifications</Text>
            {loading ? <ActivityIndicator size="large" /> : (
                <FlatList
                    data={requests}
                    keyExtractor={item => item.id}
                    renderItem={renderRequest}
                    ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, paddingTop: 60 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 20 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    name: { fontSize: 18, fontWeight: '700' },
    sub: { color: '#64748B', marginBottom: 10 },
    pathLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 15 },
    actions: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    approveBtn: { backgroundColor: '#10B981' },
    rejectBtn: { backgroundColor: '#EF4444' },
    btnText: { color: '#fff', fontWeight: '700' },
    empty: { textAlign: 'center', marginTop: 40, color: '#94A3B8' }
});
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Alert, ActivityIndicator
} from 'react-native';
import * as Clipboard from 'expo-clipboard'; // Make sure to install: npx expo install expo-clipboard
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';

export default function AdminPayoutsScreen() {
    const router = useRouter();
    const { t } = useLanguage();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        // Fetch all 'pending' requests + the user's name/avatar
        const { data, error } = await supabase
            .from('withdrawals')
            .select('*, profiles:provider_id(full_name, avatar_url)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true }); // Oldest requests first

        if (error) {
            console.error("Fetch Error:", error);
            Alert.alert(t('error'), t('couldNotLoadPayouts'));
        }
        setRequests(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text);
        mediumFeedback();
        Alert.alert(t('copied'), t('readyToPaste', { text }));
    };

    const markAsPaid = async (item: any) => {
        setProcessingId(item.id);
        try {
            // 1. Update DB Status
            const { error } = await supabase
                .from('withdrawals')
                .update({ status: 'processed' })
                .eq('id', item.id);

            if (error) throw error;

            // 2. Notify Provider
            await supabase.from('notifications').insert({
                user_id: item.provider_id,
                title: "Payout Sent",
                message: `Your withdrawal of ${item.amount.toLocaleString()} CFA has been sent.`,
                type: 'payment'
            });

            successFeedback();
            Alert.alert(t('success'), t('requestMovedProcessed'));
            fetchRequests(); // Refresh list

        } catch (e: any) {
            Alert.alert(t('error'), e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            {/* Header: Name & Date */}
            <View style={styles.row}>
                <Text style={styles.name}>{item.profiles?.full_name || "Unknown User"}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            {/* Amount & Method Badge */}
            <View style={styles.row}>
                <Text style={styles.amount}>{item.amount.toLocaleString()} CFA</Text>
                <View style={[styles.badge, item.method === 'mtn_momo' ? styles.mtn : styles.orange]}>
                    <Text style={styles.badgeText}>{item.method === 'mtn_momo' ? 'MTN' : 'ORANGE'}</Text>
                </View>
            </View>

            {/* Account Details (Click to Copy) */}
            <View style={styles.detailsBox}>
                <TouchableOpacity onPress={() => copyToClipboard(item.phone_number)} style={styles.detailRow}>
                    <Text style={styles.label}>Phone:</Text>
                    <Text style={styles.value}>{item.phone_number}</Text>
                    <Ionicons name="copy-outline" size={14} color="#0EA5E9" />
                </TouchableOpacity>
                <View style={styles.detailRow}>
                    <Text style={styles.label}>Name:</Text>
                    <Text style={styles.value}>{item.account_name || "Not provided"}</Text>
                </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
                style={styles.payBtn}
                onPress={() => markAsPaid(item)}
                disabled={!!processingId}
            >
                {processingId === item.id ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.payText}>Mark as PAID</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.title}>Admin Payouts</Text>
                <TouchableOpacity onPress={fetchRequests}>
                    <Ionicons name="refresh" size={24} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.emptyText}>All caught up! No pending payouts.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
    title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

    card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    date: { fontSize: 12, color: '#94A3B8' },
    amount: { fontSize: 24, fontWeight: '800', color: '#0F172A' },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    mtn: { backgroundColor: '#FFFBEB' },
    orange: { backgroundColor: '#FFF7ED' },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#0F172A' },

    detailsBox: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginBottom: 15 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    label: { fontSize: 13, color: '#64748B', width: 50 },
    value: { fontSize: 14, fontWeight: '700', color: '#334155' },

    payBtn: { backgroundColor: '#0F172A', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    payText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 40 }
});
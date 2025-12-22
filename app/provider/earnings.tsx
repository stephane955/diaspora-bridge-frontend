import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // Added router
import { mediumFeedback } from '@/utils/haptics';

export default function ProviderEarnings() {
    const { user } = useAuth();
    const router = useRouter(); // Initialize router
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEarnings();
    }, []);

    const fetchEarnings = async () => {
        const { data } = await supabase
            .from('project_expenses')
            .select(`
                id, amount, category, description, status, created_at,
                projects!inner(provider_id, title)
            `)
            .eq('projects.provider_id', user?.id)
            .order('created_at', { ascending: false });

        if (data) setTransactions(data);
        setLoading(false);
    };

    const totalEarned = transactions
        .filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

    const pendingAmount = transactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0);

    return (
        <View style={styles.container}>
            <NavigationBar title="My Earnings" showBack={true} />

            <View style={styles.headerCard}>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Available (CFA)</Text>
                    <Text style={styles.statValue}>{totalEarned.toLocaleString()}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Pending (CFA)</Text>
                    <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                        {pendingAmount.toLocaleString()}
                    </Text>
                </View>
            </View>

            {/* NEW: Withdrawal Action Button */}
            <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={() => {
                    mediumFeedback();
                    router.push('/provider/withdraw');
                }}
            >
                <Ionicons name="cash-outline" size={20} color="#fff" />
                <Text style={styles.withdrawText}>Withdraw Funds</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Payment History</Text>

            {loading ? <ActivityIndicator size="small" color="#0EA5E9" /> : (
                <FlatList
                    data={transactions}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <View style={styles.txnItem}>
                            <View style={[styles.statusIcon, { backgroundColor: item.status === 'approved' ? '#F0FDF4' : '#FFFBEB' }]}>
                                <Ionicons
                                    name={item.status === 'approved' ? "checkmark" : "time"}
                                    size={18}
                                    color={item.status === 'approved' ? "#16A34A" : "#D97706"}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.txnTitle}>{item.projects.title}</Text>
                                <Text style={styles.txnSub}>{item.category} • {new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                            <Text style={[styles.txnAmount, item.status === 'approved' ? styles.green : styles.orange]}>
                                {item.status === 'approved' ? '+' : ''}{item.amount.toLocaleString()}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerCard: { flexDirection: 'row', backgroundColor: '#0F172A', margin: 20, padding: 25, borderRadius: 24, alignItems: 'center' },
    stat: { flex: 1, alignItems: 'center' },
    divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
    statLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 5 },
    statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },

    // NEW Styles for Withdrawal Button
    withdrawBtn: {
        backgroundColor: '#0EA5E9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 16,
        marginHorizontal: 20,
        marginBottom: 25,
        elevation: 4,
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    withdrawText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginLeft: 20, marginBottom: 15 },
    txnItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 20, marginBottom: 10, borderRadius: 16 },
    statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    txnTitle: { fontWeight: '700', color: '#1E293B', fontSize: 14 },
    txnSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
    txnAmount: { fontWeight: '800', fontSize: 14 },
    green: { color: '#16A34A' },
    orange: { color: '#D97706' }
});
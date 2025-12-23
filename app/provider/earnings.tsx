import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; //
import { supabase } from '@/lib/supabase'; //
import { useAuth } from '@/context/AuthContext'; //

export default function EarningsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        // 1. Calculate TOTAL EARNINGS (Approved project expenses)
        const { data: income } = await supabase
            .from('project_expenses')
            .select('*')
            .eq('provider_id', user.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        // 2. Calculate TOTAL WITHDRAWALS
        const { data: payouts } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('provider_id', user.id)
            .order('created_at', { ascending: false });

        const totalIncome = income?.reduce((sum, item) => sum + item.amount, 0) || 0;
        const totalWithdrawn = payouts?.reduce((sum, item) => sum + item.amount, 0) || 0;

        // Current Wallet Balance
        setBalance(totalIncome - totalWithdrawn);

        // 3. Merge Lists for History
        const incomeList = income?.map(i => ({ ...i, type: 'credit' })) || [];
        const payoutList = payouts?.map(p => ({ ...p, type: 'debit' })) || [];

        // Combine and Sort by Date
        const combined = [...incomeList, ...payoutList].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setHistory(combined);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [user]);

    const handleWithdraw = () => {
        if (balance <= 0) {
            Alert.alert("Low Balance", "You have no funds available to withdraw.");
            return;
        }
        router.push('/provider/withdraw');
    };

    return (
        <View style={styles.container}>
            {/* Header Card */}
            <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
                <View style={styles.navRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Wallet</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.balanceContainer}>
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.balanceAmount}>{balance.toLocaleString()} CFA</Text>
                </View>

                <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw}>
                    <Text style={styles.withdrawText}>Withdraw Funds</Text>
                    <Ionicons name="arrow-forward" size={18} color="#0F172A" />
                </TouchableOpacity>
            </LinearGradient>

            <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Transaction History</Text>
            </View>

            <FlatList
                data={history}
                keyExtractor={(item) => item.id.toString() + item.type}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No transactions yet.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.txnItem}>
                        <View style={[styles.iconBox, item.type === 'debit' ? styles.debitIcon : styles.creditIcon]}>
                            <Ionicons
                                name={item.type === 'debit' ? "arrow-up" : "arrow-down"}
                                size={18}
                                color={item.type === 'debit' ? "#EF4444" : "#16A34A"}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.txnTitle}>
                                {item.type === 'debit' ? 'Payout Request' : (item.description || 'Project Payment')}
                            </Text>
                            <Text style={styles.txnDate}>
                                {new Date(item.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                        <Text style={[styles.txnAmount, item.type === 'debit' ? styles.debitText : styles.creditText]}>
                            {item.type === 'debit' ? '-' : '+'}{item.amount.toLocaleString()}
                        </Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 24, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },

    balanceContainer: { alignItems: 'center', marginBottom: 30 },
    balanceLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
    balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 8 },

    withdrawBtn: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 10 },
    withdrawText: { color: '#0F172A', fontWeight: '800', fontSize: 16 },

    historySection: { padding: 20, paddingBottom: 10 },
    historyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    listContent: { paddingHorizontal: 20 },
    txnItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    creditIcon: { backgroundColor: '#DCFCE7' },
    debitIcon: { backgroundColor: '#FEE2E2' },

    txnTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    txnDate: { color: '#64748B', fontSize: 12, marginTop: 2 },

    txnAmount: { fontSize: 16, fontWeight: '700' },
    creditText: { color: '#16A34A' },
    debitText: { color: '#EF4444' },

    emptyBox: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#94A3B8' }
});
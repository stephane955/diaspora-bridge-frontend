import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, StatusBar, Alert, Modal, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// Define Transaction Type
type Transaction = {
    id: string;
    amount: number;
    description: string;
    created_at: string;
    type: 'deposit' | 'withdrawal' | 'escrow_release';
    projects?: { title: string } | null; // Join result might be null
};

export default function ProviderEarningsScreen() {
    const { user } = useAuth();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    // --- FETCH DATA ---
    const fetchEarnings = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, projects(title)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching transactions:", error.message);
                return;
            }

            if (data) {
                // Cast data to Transaction type if needed, or rely on inference
                setTransactions(data as any);

                // Calculate Balance
                const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
                setBalance(total);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    // Fixed: Properly handle async call inside useFocusEffect
    useFocusEffect(
        useCallback(() => {
            fetchEarnings();
        }, [fetchEarnings])
    );

    // --- ACTIONS ---
    const handleWithdraw = async () => {
        if (balance <= 0) {
            Alert.alert("Error", "Insufficient funds.");
            return;
        }

        Alert.alert(
            "Request Payout",
            `Withdraw ${balance.toLocaleString()} CFA to your registered Mobile Money account?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('transactions').insert({
                                user_id: user?.id,
                                amount: -balance,
                                type: 'withdrawal',
                                description: 'Payout to Mobile Money',
                                status: 'pending'
                            });

                            if (error) {
                                Alert.alert("Error", error.message);
                            } else {
                                Alert.alert("Success", "Payout request initiated. Funds will arrive in 24h.");
                                setShowWithdrawModal(false);
                                fetchEarnings();
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message || "Transaction failed");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* --- HEADER --- */}
            <LinearGradient colors={['#0F172A', '#334155']} style={styles.header}>
                <Text style={styles.headerTitle}>My Earnings</Text>

                <View style={styles.balanceRow}>
                    <View>
                        <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                        <Text style={styles.balanceValue}>{balance.toLocaleString()} CFA</Text>
                    </View>
                    <TouchableOpacity style={styles.withdrawBtn} onPress={() => setShowWithdrawModal(true)}>
                        <Text style={styles.withdrawText}>Withdraw</Text>
                        <Ionicons name="arrow-forward" size={16} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {/* Monthly Chart Visual */}
                <View style={styles.chartContainer}>
                    {[40, 70, 30, 80, 50, 90, 60].map((h, i) => (
                        <View key={i} style={styles.chartBarWrapper}>
                            <View style={[styles.chartBar, { height: `${h}%`, opacity: i === 6 ? 1 : 0.5 }]} />
                        </View>
                    ))}
                </View>
            </LinearGradient>

            {/* --- BODY --- */}
            <View style={styles.body}>
                <Text style={styles.sectionTitle}>Transaction History</Text>

                {loading ? (
                    <ActivityIndicator color="#0F172A" style={{ marginTop: 20 }} />
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEarnings(); }} />}
                    >
                        {transactions.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="wallet-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No earnings yet.</Text>
                                <Text style={styles.emptySub}>Complete jobs to get paid.</Text>
                            </View>
                        ) : (
                            transactions.map((t) => {
                                const isIncome = t.amount > 0;
                                return (
                                    <View key={t.id} style={styles.card}>
                                        <View style={[styles.iconBox, isIncome ? styles.bgGreen : styles.bgRed]}>
                                            <Ionicons
                                                name={isIncome ? "arrow-down" : "arrow-up"}
                                                size={20}
                                                color={isIncome ? "#16A34A" : "#EF4444"}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardTitle}>
                                                {t.projects?.title || t.description || "Transaction"}
                                            </Text>
                                            <Text style={styles.cardDate}>
                                                {new Date(t.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <Text style={[styles.amount, isIncome ? styles.textGreen : styles.textRed]}>
                                            {isIncome ? "+" : ""}{Number(t.amount).toLocaleString()}
                                        </Text>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                )}
            </View>

            {/* --- WITHDRAW MODAL --- */}
            <Modal visible={showWithdrawModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Payout Method</Text>

                        <TouchableOpacity style={styles.payoutOption} onPress={handleWithdraw}>
                            <Image
                                source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Orange_Money_logo_2016.svg/1200px-Orange_Money_logo_2016.svg.png' }}
                                style={styles.payoutIcon}
                                resizeMode="contain"
                            />
                            <View>
                                <Text style={styles.payoutName}>Orange Money</Text>
                                <Text style={styles.payoutSub}>Instant Transfer</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.payoutOption} onPress={handleWithdraw}>
                            <Image
                                source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/9/93/MTN_Logo.svg' }}
                                style={styles.payoutIcon}
                                resizeMode="contain"
                            />
                            <View>
                                <Text style={styles.payoutName}>MTN Mobile Money</Text>
                                <Text style={styles.payoutSub}>Instant Transfer</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowWithdrawModal(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // Header
    header: { paddingTop: 70, paddingBottom: 30, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 24, textAlign: 'center' },

    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 30 },
    balanceLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800' },

    withdrawBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    withdrawText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },

    // Chart
    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 60, paddingHorizontal: 10 },
    chartBarWrapper: { height: '100%', justifyContent: 'flex-end', width: 8 },
    chartBar: { width: '100%', backgroundColor: '#fff', borderRadius: 4 },

    // Body
    body: { flex: 1, padding: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },

    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, gap: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8 },
    iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    bgGreen: { backgroundColor: '#DCFCE7' },
    bgRed: { backgroundColor: '#FEF2F2' },

    cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    cardDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
    amount: { fontSize: 16, fontWeight: '700' },
    textGreen: { color: '#16A34A' },
    textRed: { color: '#EF4444' },

    emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    emptySub: { color: '#64748B' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 24, textAlign: 'center' },

    payoutOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, marginBottom: 12, gap: 16 },
    payoutIcon: { width: 40, height: 40 },
    payoutName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    payoutSub: { fontSize: 12, color: '#64748B' },

    cancelBtn: { marginTop: 10, padding: 16, alignItems: 'center' },
    cancelText: { fontWeight: '700', color: '#64748B' }
});
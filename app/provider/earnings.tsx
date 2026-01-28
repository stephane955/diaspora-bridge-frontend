import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext'; // <--- 1. Import Language

type Transaction = {
    id: string;
    amount: number;
    description: string;
    created_at: string;
    type: 'deposit' | 'withdrawal' | 'escrow_release';
    projects?: { title: string } | null;
};

export default function ProviderEarningsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage(); // <--- 2. Use Hook

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- FETCH DATA ---
    const fetchEarnings = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, projects(title)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setTransactions(data as any);
                // Calculate balance (simple sum for now)
                const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
                setBalance(total);
            }
        } catch (err) {
            console.error("Error fetching earnings:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchEarnings(); }, [fetchEarnings]));

    // --- RENDER ---
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* --- PREMIUM HEADER --- */}
            <LinearGradient colors={['#0F172A', '#334155']} style={styles.header}>
                <Text style={styles.headerTitle}>{t('walletTitle') || "My Earnings"}</Text>

                <View style={styles.balanceRow}>
                    <View>
                        <Text style={styles.balanceLabel}>{t('totalBalance') || "TOTAL BALANCE"}</Text>
                        <Text style={styles.balanceValue}>{balance.toLocaleString()} CFA</Text>
                    </View>

                    {/* WITHDRAW BUTTON with MOMO Branding */}
                    <TouchableOpacity
                        style={styles.withdrawBtn}
                        onPress={() => router.push('/provider/payout-setup')}
                    >
                        <View>
                            <Text style={styles.withdrawText}>{t('withdraw') || "Withdraw"}</Text>
                            {/* LOCAL TRUST FACTOR: */}
                            <Text style={styles.momoText}>MOMO / OM</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={16} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {/* VISUAL CHART (Aesthetic only) */}
                <View style={styles.chartContainer}>
                    {[30, 50, 40, 70, 50, 80, 60, 90, 40].map((h, i) => (
                        <View key={i} style={styles.chartBarWrapper}>
                            <View style={[styles.chartBar, { height: `${h}%`, opacity: i === 7 ? 1 : 0.4 }]} />
                        </View>
                    ))}
                </View>
            </LinearGradient>

            {/* --- TRANSACTION LIST --- */}
            <View style={styles.body}>
                <Text style={styles.sectionTitle}>{t('history') || "Transaction History"}</Text>

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
                                <Text style={styles.emptyText}>{t('noEarnings') || "No earnings yet."}</Text>
                                <Text style={styles.emptySub}>{t('completeJobs') || "Complete jobs to see transactions."}</Text>
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
                                                {new Date(t.created_at).toLocaleDateString(undefined, {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // Header
    header: {
        paddingTop: 70,
        paddingBottom: 20,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 24, textAlign: 'center', opacity: 0.9 },

    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    balanceLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
    balanceValue: { color: '#fff', fontSize: 32, fontWeight: '800' },

    withdrawBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    withdrawText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
    momoText: { fontSize: 8, color: '#F59E0B', fontWeight: '800', letterSpacing: 0.5 },

    // Chart
    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 50, paddingHorizontal: 10 },
    chartBarWrapper: { height: '100%', justifyContent: 'flex-end', width: 6 },
    chartBar: { width: '100%', backgroundColor: '#fff', borderRadius: 4 },

    // Body
    body: { flex: 1, padding: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },

    // Card
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, gap: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
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
});
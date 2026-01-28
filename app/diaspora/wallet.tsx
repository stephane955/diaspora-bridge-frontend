import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ClientWalletScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);      // Money ready to spend
    const [escrowed, setEscrowed] = useState(0);    // Money locked in projects
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            // 1. Get Transaction History
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setTransactions(data);
                // Calculate Available Balance (Sum of all txns)
                const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
                setBalance(total);
            }

            // 2. Calculate Escrowed Amount (Sum of 'locked' milestones)
            // We find milestones where the project owner is ME, and status is 'locked'
            const { data: milestones } = await supabase
                .from('milestones')
                .select('amount, status, projects!inner(owner_id)')
                .eq('projects.owner_id', user.id)
                .eq('status', 'locked');

            const lockedTotal = milestones?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
            setEscrowed(lockedTotal);

        } catch (err) {
            console.error("Client Wallet Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleTopUp = () => {
        // Placeholder for Stripe PaymentSheet
        Alert.alert("Add Funds", "This would open the Stripe Payment Gateway.");
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* HEADER */}
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>{t('clientDashboard.myWallet') || "My Wallet"}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                {/* 1. MASTER CARD (Blue for Clients) */}
                <LinearGradient colors={['#2563EB', '#1E40AF']} style={styles.masterCard}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardLabel}>AVAILABLE FUNDS</Text>
                            <Text style={styles.cardAmount}>{balance.toLocaleString()} CFA</Text>
                        </View>
                        {/* Top Up Button inside Card */}
                        <TouchableOpacity style={styles.topUpBadge} onPress={handleTopUp}>
                            <Ionicons name="add" size={16} color="#2563EB" />
                            <Text style={styles.topUpText}>Top Up</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    {/* Escrow Tracker */}
                    <View style={styles.escrowRow}>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                            <Ionicons name="lock-closed" size={14} color="#BFDBFE" />
                            <Text style={styles.escrowLabel}>Locked in Escrow:</Text>
                        </View>
                        <Text style={styles.escrowAmount}>{escrowed.toLocaleString()} CFA</Text>
                    </View>
                </LinearGradient>

                {/* 2. QUICK ACTIONS */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleTopUp}>
                        <View style={[styles.iconCircle, {backgroundColor: '#EFF6FF'}]}>
                            <Ionicons name="card" size={24} color="#2563EB" />
                        </View>
                        <Text style={styles.actionText}>Add Funds</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/client/projects')}>
                        <View style={[styles.iconCircle, {backgroundColor: '#F0FDF4'}]}>
                            <Ionicons name="shield-checkmark" size={24} color="#16A34A" />
                        </View>
                        <Text style={styles.actionText}>Release Funds</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/modal')}>
                        <View style={[styles.iconCircle, {backgroundColor: '#F1F5F9'}]}>
                            <Ionicons name="headset" size={24} color="#64748B" />
                        </View>
                        <Text style={styles.actionText}>Support</Text>
                    </TouchableOpacity>
                </View>

                {/* 3. HISTORY */}
                <Text style={styles.sectionTitle}>History</Text>
                <View style={styles.listContainer}>
                    {transactions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="wallet-outline" size={32} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No transactions yet.</Text>
                        </View>
                    ) : (
                        transactions.map((t) => (
                            <View key={t.id} style={styles.txnItem}>
                                <View style={[styles.txnIcon, t.amount > 0 ? styles.inIcon : styles.outIcon]}>
                                    <Ionicons
                                        name={t.amount > 0 ? "arrow-down" : "arrow-up"}
                                        size={18}
                                        color={t.amount > 0 ? "#16A34A" : "#64748B"}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.txnTitle}>{t.description || "Transaction"}</Text>
                                    <Text style={styles.txnSub}>{new Date(t.created_at).toLocaleDateString()}</Text>
                                </View>
                                <Text style={[styles.txnAmount, t.amount > 0 ? styles.textGreen : styles.textNeutral]}>
                                    {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    navTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    scrollContent: { padding: 20, paddingBottom: 100 },

    // CARD STYLE (Client Specific)
    masterCard: { width: '100%', borderRadius: 24, padding: 24, marginBottom: 30, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    cardLabel: { color: '#BFDBFE', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    cardAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },

    topUpBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    topUpText: { color: '#2563EB', fontSize: 12, fontWeight: '800' },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 15 },

    escrowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    escrowLabel: { color: '#BFDBFE', fontSize: 13, fontWeight: '600' },
    escrowAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // ACTIONS
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    actionBtn: { alignItems: 'center', gap: 8, width: '30%' },
    iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor:'#000', shadowOpacity: 0.05, elevation: 1, backgroundColor: '#fff' },
    actionText: { color: '#475569', fontWeight: '600', fontSize: 12 },

    // HISTORY LIST
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 15 },
    listContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 8 },
    txnItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 15 },
    txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    inIcon: { backgroundColor: '#DCFCE7' },
    outIcon: { backgroundColor: '#F1F5F9' },
    txnTitle: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
    txnSub: { color: '#94A3B8', fontSize: 11 },
    txnAmount: { fontWeight: '700', fontSize: 15 },
    textGreen: { color: '#16A34A' },
    textNeutral: { color: '#64748B' },

    emptyState: { alignItems: 'center', padding: 40 },
    emptyText: { color: '#94A3B8', fontSize: 14 }
});
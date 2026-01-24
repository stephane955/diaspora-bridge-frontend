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
import { mediumFeedback, lightFeedback } from '@/utils/haptics';

export default function ProviderWalletScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('unverified');

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            // 1. Fetch Profile for Verification Status
            const { data: profile } = await supabase
                .from('profiles')
                .select('verification_status')
                .eq('id', user.id)
                .single();
            if (profile) setVerificationStatus(profile.verification_status);

            // 2. Get Transaction History
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setTransactions(data);
                const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
                setBalance(total);
            }
        } catch (err) {
            console.error("Wallet Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleWithdraw = () => {
        mediumFeedback();

        // --- THE VERIFICATION BARRIER ---
        if (verificationStatus !== 'verified') {
            Alert.alert(
                "Verification Required",
                "To prevent fraud and comply with regulations, you must verify your identity before withdrawing funds.",
                [
                    { text: "Later", style: "cancel" },
                    { text: "Get Verified", onPress: () => router.push('/provider/verification') }
                ]
            );
            return;
        }

        if (balance <= 0) {
            Alert.alert("Empty Wallet", "You don't have any funds to withdraw yet.");
            return;
        }

        // Future: Integration with Mobile Money (Orange/MTN) or Bank
        router.push('/provider/payout-setup');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>My Earnings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                {/* MASTER CARD */}
                <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.masterCard}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardLabel}>TOTAL EARNINGS</Text>
                            <Text style={styles.cardAmount}>{balance.toLocaleString()} CFA</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: verificationStatus === 'verified' ? '#059669' : '#B45309' }]}>
                            <Ionicons
                                name={verificationStatus === 'verified' ? "shield-checkmark" : "warning"}
                                size={14} color="#fff"
                            />
                            <Text style={styles.badgeText}>{verificationStatus.toUpperCase()}</Text>
                        </View>
                    </View>

                    <View style={styles.cardFooter}>
                        <Text style={styles.footerText}>Secure Payouts Enabled</Text>
                        <Text style={styles.footerSub}>Funds are held in Escrow until project milestones are released.</Text>
                    </View>
                </LinearGradient>

                {/* QUICK ACTIONS */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleWithdraw}>
                        <View style={[styles.iconCircle, verificationStatus !== 'verified' && styles.lockedCircle]}>
                            <Ionicons
                                name={verificationStatus === 'verified' ? "cash-outline" : "lock-closed"}
                                size={24}
                                color={verificationStatus === 'verified' ? "#16A34A" : "#94A3B8"}
                            />
                        </View>
                        <Text style={styles.actionText}>Withdraw</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/provider/active')}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="briefcase-outline" size={24} color="#0EA5E9" />
                        </View>
                        <Text style={styles.actionText}>Job Status</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={mediumFeedback}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="help-buoy-outline" size={24} color="#6366F1" />
                        </View>
                        <Text style={styles.actionText}>Support</Text>
                    </TouchableOpacity>
                </View>

                {/* TRANSACTIONS */}
                <Text style={styles.sectionTitle}>Transaction History</Text>
                <View style={styles.listContainer}>
                    {transactions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No payments received yet.</Text>
                        </View>
                    ) : (
                        transactions.map((t) => (
                            <View key={t.id} style={styles.txnItem}>
                                <View style={[styles.txnIcon, t.amount > 0 ? styles.inIcon : styles.outIcon]}>
                                    <Ionicons name={t.amount > 0 ? "add" : "remove"} size={18} color={t.amount > 0 ? "#16A34A" : "#DC2626"} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.txnTitle}>{t.description || "Work Payment"}</Text>
                                    <Text style={styles.txnSub}>{new Date(t.created_at).toLocaleDateString()}</Text>
                                </View>
                                <Text style={[styles.txnAmount, t.amount > 0 ? styles.textGreen : styles.textRed]}>
                                    {t.amount.toLocaleString()}
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
    masterCard: { width: '100%', borderRadius: 24, padding: 24, marginBottom: 30 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 },
    cardLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
    cardAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    cardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
    footerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    footerSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    actionBtn: { alignItems: 'center', gap: 8, width: '30%' },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowOpacity: 0.05 },
    lockedCircle: { backgroundColor: '#F1F5F9' },
    actionText: { color: '#475569', fontWeight: '600', fontSize: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 15 },
    listContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 8 },
    txnItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 15 },
    txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    inIcon: { backgroundColor: '#F0FDF4' },
    outIcon: { backgroundColor: '#FEF2F2' },
    txnTitle: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
    txnSub: { color: '#94A3B8', fontSize: 11 },
    txnAmount: { fontWeight: '700', fontSize: 15 },
    textGreen: { color: '#16A34A' },
    textRed: { color: '#DC2626' },
    emptyState: { alignItems: 'center', padding: 40 },
    emptyText: { color: '#94A3B8', fontSize: 14 }
});
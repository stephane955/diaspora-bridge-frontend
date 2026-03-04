import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, StatusBar, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import NavigationBar from '@/components/NavigationBar';
import ScreenGradient from '@/components/ScreenGradient';
import PulseLoader from '@/components/PulseLoader';
import VaultGate from '@/components/VaultGate';
import { theme } from '@/constants/theme';
import { successFeedback, mediumFeedback } from '@/utils/haptics';

export default function ClientWalletScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [escrowed, setEscrowed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setTransactions(data);
                const total = data.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
                setBalance(total);
            }

            const { data: milestones } = await supabase
                .from('milestones')
                .select('amount, status, projects!inner(owner_id)')
                .eq('projects.owner_id', user.id)
                .eq('status', 'locked');

            const lockedTotal = milestones?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0;
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
        successFeedback();
        Alert.alert("Add Funds", "This would open the Stripe Payment Gateway.");
    };

    const walletContent = loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <PulseLoader />
        </View>
    ) : (
        <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                {/* Mesh Gradient Balance Card */}
                <LinearGradient
                    colors={theme.gradient.mesh}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.masterCard}
                >
                    <View style={styles.cardPattern}>
                        <View style={[styles.patternCircle, { top: -20, right: -20 }]} />
                        <View style={[styles.patternCircle, { bottom: 10, left: -30, width: 80, height: 80 }]} />
                    </View>

                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardLabel}>AVAILABLE FUNDS</Text>
                            <Text style={styles.cardAmount}>{balance.toLocaleString()} CFA</Text>
                        </View>
                        <TouchableOpacity style={styles.topUpBadge} onPress={handleTopUp} activeOpacity={0.7}>
                            <Ionicons name="add" size={16} color={theme.colors.active} />
                            <Text style={styles.topUpText}>Top Up</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.escrowRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.escrowLabel}>Locked in Escrow:</Text>
                        </View>
                        <Text style={styles.escrowAmount}>{escrowed.toLocaleString()} CFA</Text>
                    </View>
                </LinearGradient>

                {/* Quick Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleTopUp} activeOpacity={0.7}>
                        <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.iconCircle}>
                            <Ionicons name="card" size={24} color={theme.colors.active} />
                        </LinearGradient>
                        <Text style={styles.actionText}>Add Funds</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => { successFeedback(); router.push('/diaspora/projects'); }} activeOpacity={0.7}>
                        <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={styles.iconCircle}>
                            <Ionicons name="shield-checkmark" size={24} color={theme.colors.success} />
                        </LinearGradient>
                        <Text style={styles.actionText}>Release Funds</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => { mediumFeedback(); router.push('/modal'); }} activeOpacity={0.7}>
                        <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={styles.iconCircle}>
                            <Ionicons name="headset" size={24} color={theme.colors.textMuted} />
                        </LinearGradient>
                        <Text style={styles.actionText}>Support</Text>
                    </TouchableOpacity>
                </View>

                {/* History */}
                <Text style={styles.sectionTitle}>History</Text>
                <View style={styles.listContainer}>
                    {transactions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="wallet-outline" size={48} color={theme.colors.border} />
                            <Text style={styles.emptyTitle}>No transactions yet</Text>
                            <Text style={styles.emptyText}>Fund your wallet to get started.</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={handleTopUp} activeOpacity={0.7}>
                                <Text style={styles.emptyBtnText}>Add Funds Now</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        transactions.map((txn) => (
                            <View key={txn.id} style={styles.txnItem}>
                                <View style={[styles.txnIcon, txn.amount > 0 ? styles.inIcon : styles.outIcon]}>
                                    <Ionicons
                                        name={txn.amount > 0 ? "arrow-down" : "arrow-up"}
                                        size={18}
                                        color={txn.amount > 0 ? theme.colors.success : theme.colors.textMuted}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.txnTitle}>{txn.description || "Transaction"}</Text>
                                    <Text style={styles.txnSub}>{new Date(txn.created_at).toLocaleDateString()}</Text>
                                </View>
                                <Text style={[styles.txnAmount, txn.amount > 0 ? styles.textGreen : styles.textNeutral]}>
                                    {txn.amount > 0 ? "+" : ""}{txn.amount.toLocaleString()}
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
    );

    return (
        <ScreenGradient>
            <StatusBar barStyle="light-content" />
            <NavigationBar title={t('clientDashboard.myWallet') ?? 'Wallet'} showBack={false} dynamicColor={theme.colors.active} />
            <VaultGate promptMessage="Unlock Wallet to view balance and transactions." lockOnBlur>
                {walletContent}
            </VaultGate>
        </ScreenGradient>
    );
}

const styles = StyleSheet.create({
    scrollContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 120 },

    masterCard: {
        width: '100%',
        borderRadius: theme.radii.xl,
        padding: 24,
        marginBottom: 28,
        overflow: 'hidden',
        ...theme.shadow.glow,
    },
    cardPattern: { ...StyleSheet.absoluteFillObject },
    patternCircle: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, ...theme.typography.label },
    cardAmount: { color: '#fff', fontSize: 34, ...theme.typography.title, marginTop: 4 },
    topUpBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radii.pill },
    topUpText: { color: theme.colors.active, fontSize: 12, fontWeight: '800' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 15 },
    escrowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    escrowLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
    escrowAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    actionBtn: { alignItems: 'center', gap: 8, width: '30%' },
    iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    actionText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 12 },

    sectionTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text, marginBottom: 15 },
    listContainer: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: theme.spacing.xs, ...theme.shadow.soft, shadowOpacity: 0.05 },
    txnItem: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, gap: 15 },
    txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    inIcon: { backgroundColor: theme.colors.success + '20' },
    outIcon: { backgroundColor: theme.colors.surfaceAlt },
    txnTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
    txnSub: { color: theme.colors.textSubtle, fontSize: 11 },
    txnAmount: { fontWeight: '700', fontSize: 15 },
    textGreen: { color: theme.colors.success },
    textNeutral: { color: theme.colors.textMuted },

    emptyState: { alignItems: 'center', padding: theme.spacing.xxl, gap: 8 },
    emptyTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    emptyText: { color: theme.colors.textMuted, fontSize: 14 },
    emptyBtn: {
        marginTop: 12,
        backgroundColor: theme.colors.active,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: theme.radii.pill,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

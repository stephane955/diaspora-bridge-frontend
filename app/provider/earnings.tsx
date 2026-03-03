import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';

type Transaction = {
    id: string;
    amount: number;
    description: string;
    created_at: string;
    type: 'deposit' | 'withdrawal' | 'escrow_release';
    projects?: { title: string } | null;
};

export default function ProviderEarningsScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

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
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" />

            {/* --- PREMIUM HEADER --- */}
            <LinearGradient colors={[theme.colors.primary, theme.colors.primarySoft]} style={styles.header}>
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
                        <Ionicons name="arrow-forward" size={16} color={theme.colors.text} />
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
                    <ActivityIndicator color={theme.colors.text} style={{ marginTop: 20 }} />
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEarnings(); }} />}
                    >
                        {transactions.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="wallet-outline" size={48} color={theme.colors.textSubtle} />
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
                                                color={isIncome ? theme.colors.success : theme.colors.danger}
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
    container: { flex: 1, backgroundColor: theme.colors.background },

    header: {
        paddingTop: 70,
        paddingBottom: theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        ...theme.shadow.soft,
    },
    headerTitle: { color: theme.colors.surface, fontSize: 18, fontWeight: '700', marginBottom: theme.spacing.xl, textAlign: 'center', opacity: 0.9 },

    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    balanceLabel: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
    balanceValue: { color: theme.colors.surface, fontSize: 32, fontWeight: '800' },

    withdrawBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.pill },
    withdrawText: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
    momoText: { fontSize: 8, color: theme.colors.warning, fontWeight: '800', letterSpacing: 0.5 },

    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 50, paddingHorizontal: theme.spacing.sm },
    chartBarWrapper: { height: '100%', justifyContent: 'flex-end', width: 6 },
    chartBar: { width: '100%', backgroundColor: theme.colors.surface, borderRadius: 4 },

    body: { flex: 1, padding: theme.spacing.xl },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing.md },

    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radii.md, marginBottom: theme.spacing.sm, gap: theme.spacing.md, ...theme.shadow.soft, borderWidth: 1, borderColor: theme.colors.border },
    iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    bgGreen: { backgroundColor: theme.colors.success + '25' },
    bgRed: { backgroundColor: theme.colors.danger + '18' },

    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    cardDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    amount: { fontSize: 16, fontWeight: '700' },
    textGreen: { color: theme.colors.success },
    textRed: { color: theme.colors.danger },

    emptyState: { alignItems: 'center', marginTop: 60, gap: theme.spacing.sm },
    emptyText: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
    emptySub: { color: theme.colors.textMuted },
});